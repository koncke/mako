# Hallazgos de MaKo (IA)

Lo que hay que saber antes de tocar los prompts (`lib/mako-prompts.ts`,
`lib/prompt-registry.ts`), el ruteo de modelos (`lib/model-registry.ts`), la cascada barata
(`lib/ai-cheap.ts`) o el doer (`lib/mako-doer-*.ts`). **No es un changelog.**

## Un permiso de Claude con fecha vence y, al día siguiente, da rojo en cualquier rama (14/11/2026)

**El síntoma:** la corrida 1306 de `punta/spy-gurus` dio rojo en `tests/closing-su-claude.test.ts`, y esa rama sólo tocaba Spy.
**El diagnóstico obvio era el equivocado:** no fue la rama de Spy. El permiso de `closing` en `CLAUDE_PERMITIDO`
(`lib/veto-claude.ts`) tiene `hasta: '2026-11-13'` y vence por diseño («vencer es la decisión por default»). El hijo del test
(`tests/_closing-su-claude-hijo.ts`) fijaba el reloj sólo en el tramo «después del 13/11»; el resto corría con la fecha real,
así que desde el 14/11 los casos que necesitan el permiso vigente caían en «venció», en cualquier punta que arrastrara el test.
**La regla:** un test que dependa de un permiso, un tope o un plazo con fecha fija el reloj (`fijarReloj` en el hijo, o `hoy`
en `evaluarPermiso`). Nunca la fecha real: un test así es una bomba con fecha.
**En producción:** desde el 14/11, el Closing Analyst ya no corre con la clave de la plataforma y cada negocio usa su Claude,
como estaba decidido. Renovar el permiso (unos US$13 cada 30 días) es una decisión de Martín.

## Una nota de voz de 4 s tardaba de 11 a ~105 s: Gemini escuchaba primero (12/11/2026, medido en producción)

**Síntoma:** en el chat de Image, grabar una nota y mandarla dejaba «Enviando…» hasta 105 s; la misma nota, medida tres veces
contra `/api/plan-dictado` (ws 9): 16 s, 11 s y más de 29 s. La transcripción salía bien: el problema era sólo el tiempo.

**Causa:** el orden de escucha es `CASCADA_STT = ['gemini', 'groq', 'openai']`, y `gemini-flash-latest` se cuelga hasta su plazo de
60 s por cuenta (`sttGemini`, `AbortSignal.timeout(60000)`), cuenta por cuenta, antes de llegar a Groq (Whisper, ~1-2 s). Lo mismo
que se había medido el 28/10 con los grupos de WhatsApp (`notaDeVozDelGrupo`), que ya iban con Groq primero; las notas de los chats y
el dictado no.

**La regla:** una nota CORTA (hasta `NOTA_CORTA_BYTES`, 2 MB: varios minutos de opus) escucha con Groq primero y Gemini queda de
respaldo (no se saca, como en los grupos). Lo decide `transcribirAudio` adentro, por el PESO (`ordenDeEscucha`, lib/ai-cheap.ts),
así que vale para toda nota que alguien espera sin que la ruta pida nada. El audio de un anuncio o de una clase (más pesado) sigue
con la cascada de siempre. Test: tests/stt-red.test.ts (roto a propósito: sin usar el orden, cae).
⚠️ **El arreglo obvio era el equivocado.** El primero sumó un `notaDeVozCorta` a la llamada de /api/plan-dictado y renombró la
cascada: dos tests que leen ESAS líneas con una expresión exacta cayeron en la punta (tests/chat-nota-de-voz.test.ts 6, que la nota
siga con `pii`; tests/doer-falla.test.ts 15, que la nota de un GRUPO nunca pase por Gemini). Aflojarles la expresión fue el
segundo error: el Cerebro lo frenó, «NO cambies los tests: cuidan reglas a propósito». **Un test de guardia no se acomoda al
cambio: el cambio se acomoda a él.** Antes de tocar una línea de `transcribirAudio` o de una ruta de audio, `grep` de esa línea en
tests/, y si está, el cambio va en otra línea.

## No hay caché de prompt: cada llamada del turno de WhatsApp paga sus ~9.900 tokens de entrada enteros (11/11/2026, medido)

**Lo medido** (`anthropic_usage`, 7 días): `mako-doer-in` hizo 101 llamadas en Haiku 4.5, con 9.916 tokens de entrada y 108 de salida
de promedio, US$1,06 en total, y **0 tokens leídos de caché**. `lib/anthropic.ts` no manda `cache_control`. Un turno son unas 2,1
llamadas, y la segunda re-manda el mismo system y las mismas herramientas.

**Por qué importa ahora:** el historial de la conversación del módulo común (lib/conversacion.ts) suma entre 3.000 y 6.000 tokens por
llamada. Estimado: unos US$35 por mes entre WhatsApp y la app, el 4 % del crédito.

**La regla:** lo estable va primero y con `cache_control` (el system y las herramientas), y lo que cambia (la charla, el mensaje), al
final. Haiku 4.5 cachea desde 4.096 tokens, y el turno de WhatsApp los pasa. Estimado: la segunda llamada del turno paga una décima
parte de lo cacheado, un ahorro de ~40 %. **Hecho el 12/11** en `chatClaudeTools` (`systemConCache`, lib/anthropic.ts;
tests/cache-de-prompt.test.ts). Un hijo de test que leía el system con `String(b.system)` daba «[object Object]» con los bloques: se
leen los dos formatos. **Sin medir:** que en producción `anthropic_usage.cache_read_tokens` deje de ser 0 en `mako-doer-in`.

## Un prompt «hardcodeado» puede tener el default en un archivo que la UI importa — y entonces el registro no alcanza (6/11/2026)

**Síntoma (items 26, 129 y 197 del barrido del 6/11):** «Las instrucciones de carruseles y stories están fijas y no se pueden
tocar: para cambiar cómo escribe MaKo un carrusel hay que pedirle un cambio de código a alguien del equipo». Los tres items
apuntaban al mismo archivo, `lib/ig-writer.ts`, y los tres decían lo mismo: pasar sus prompts al patrón editable.

**El diagnóstico obvio era el equivocado, dos veces.**

1. **Los prompts de `lib/ig-writer.ts` NO son las instrucciones de cómo se escribe un carrusel.** Sus dos templates son el
   andamio (quién sos, qué formato, devolvé JSON); lo que de verdad dice cómo se escribe un carrusel es
   `METODOLOGIA_CARRUSEL` / `METODOLOGIA_STORY` / `METODOLOGIA_REEL` + `METODOLOGIA_TRANSVERSAL`, y **esos viven en otro
   archivo** (`lib/ig-formatos.ts`), entran por el slot `{{metodologia}}` y eran lo que el item pedía poder tocar. Registrar
   sólo los dos templates cumple la letra del pendiente y no el pedido: seguirías necesitando un commit para cambiar la
   doctrina del carrusel.
2. **La pantalla que usa esa metodología no es la que decía el item.** `/carousels` y `/reels` se retiraron el 29/10/2026 y
   `/stories` de escritorio quedó deprecada el mismo día: las tres redirigen (a Image y al Copywriter). El único consumidor
   del motor es hoy `app/stories/actions.ts` → `generarSecuenciaAction`, que lo lee `/m/stories` (el teléfono, por URL).
   Pero la metodología tiene **un segundo call site, y ése sí es el camino del cliente**: `lib/copywriter/ia.ts` la suma
   cuando el guion es de tipo Reel o Story. Haber tocado sólo `lib/ig-writer.ts` habría dejado al Copywriter —la pantalla
   real— escribiendo con el texto hardcodeado, con el registro diciendo «editable».

**La regla:** cuando el DEFAULT de un prompt vive en un módulo que la UI también importa (sin `server-only`, porque la
pantalla necesita otra cosa del mismo archivo), **la resolución editable va en un módulo server aparte y TODOS los call
sites pasan por ahí**. Acá: el default queda en `lib/ig-formatos.ts` (una cosa, un lugar) y `lib/ig-metodologia.ts`
(`metodologiaIgVigente`) resuelve lo vigente. Un call site que se quede con la constante queda **mudo**: el usuario edita en
/configuraciones y esa pantalla sigue escribiendo igual, sin un error, sin un tipo roto y sin que el registro lo note. La
forma de que no vuelva a pasar es contar los usos de la constante en un test (`tests/ig-writer-prompts.test.ts` fija que
`lib/ig-writer.ts` tenga CERO y que el único del Copywriter sea el respaldo del `.catch`).

**Y el orden de los bloques vive en UNA función.** Al existir dos caminos (el default `metodologiaDe` y el editable
`metodologiaIgVigente`) aparece una forma de drift que nada chequea: que el prompt sin editar y el mismo prompt editado le
lleguen al modelo en distinto orden. Por eso `componerMetodologia` (lib/ig-formatos.ts) es la única que decide «primero la
del formato, después la transversal», y el test compara las dos salidas con nada editado: tienen que ser idénticas,
carácter por carácter.

**Lo que a propósito NO se registró:** los tres contratos JSON (`REEL_JSON_SHAPE`, `CARRUSEL_JSON_SHAPE`,
`STORY_JSON_SHAPE`, lib/ig-writer.ts). Los lee el saneo determinista del MISMO archivo: editarlos desde /configuraciones
sería editar el parser, y el síntoma sería «la pieza vino sin escenas» en toda pieza. Es el mismo criterio que el grupo
«Creador de campañas», donde `{{jsonShape}}` es un slot y no una entrada.

**Sin hacer, y dónde vive:** `buildContenidoBrief` (lib/ig-writer.ts) envuelve el perfil del negocio con
`contenidoNoConfiable` pero **no** las etiquetas de las etapas del funnel ni los trozos de conocimiento, que también los
escribe gente (`getFunnelDefault`, `formatKnowledge`). Es el mismo tenant, así que el riesgo es bajo, pero el archivo
declara la regla y no la cumple entera. Se dejó porque cerrarla cambia el texto que se le manda al modelo y eso es una
decisión aparte de la editabilidad.
## Ninguna guarda del pre-push mira el registro de prompts: un prompt mal cableado entra en silencio (medido el 6/11/2026)

**Síntoma:** ninguno. Un prompt que no está en `lib/prompt-registry.ts` funciona igual en runtime
(`getPromptText` hace `override ?? fallback`); lo único que pasa es que no aparece en /configuraciones y
editarlo no hace nada. Y un slot `{{x}}` que el `variables:` de la Entry no declara viaja LITERAL al modelo,
porque `renderTemplate` reemplaza sólo los slots declarados — a propósito, por anti-inyección.

**Lo medido, para que nadie lo vuelva a estimar:**

- `lib/prompt-registry.ts` tiene **165 `key:` literales** (más 6 que genera `mako.fase.*` y 2 de
  `PROMPTS_NEWSLETTER`: ~173 entradas en runtime).
- **2.307 archivos `*.test.ts`, y ninguno importaba el `REGISTRY`.** Medición exacta: antes de este commit,
  `grep -rln '\bREGISTRY\b' tests/` devolvía **0 archivos**.
- **`scripts/guardas-push.sh` tiene 0 ocurrencias de la palabra «prompt».** Las ~17 guardas que corre miran
  tipos de bitácoras, claves en el diff, rutas de Windows en tests, módulos `.ts`, hooks de React y seis
  sincronías de texto generado. Ninguna mira un prompt. `scripts/tests-afectados.mjs` elige tests por
  archivo tocado, no por key de prompt.
- **Y hay 29 keys huérfanas HOY**: llamadas con `renderPrompt(...)`/`getPromptText(...)` y ausentes del
  REGISTRY, o sea no editables, violando la regla «todo prompt de MaKo es editable»:
  `archivero.preguntas.system`, `avatares.{system,user}`, `avatares.siguiente.{system,user}`,
  `chatagent.handoff`, `checklist.batch.{system,user}`, `entregable.{system,user}`,
  `entregable.siguiente.{system,user}`, `guardian.audiencia.{system,user}`,
  `guardian.fecha-debate.{system,user}`, `guardian.nuevas.{system,user}`,
  `guardian.proy-nuevos.{system,user}`, `guardian.proyectos.{system,user}`, `plan.seed.{system,user}`,
  `razones.{system,user,sugerir,guion}`, `setting.guion_audio`.
  Es un PISO: sólo cuenta keys literales en el primer argumento, así que una key armada en una tabla no la ve.

**La causa:** el chequeo existe, pero copiado a mano y por feature. `tests/offer-ia-cableado.test.ts:167-203`
hace las tres comparaciones bien (call-sites ↔ registro ↔ slots) **para las 9 keys de `offer.*` listadas a
mano en `:151-161`**. `tests/closing-entrega.test.ts`, `tests/copywriter-ia.test.ts` y
`tests/editor-landing-ia.test.ts` hacen versiones parciales, cada una con su lista. Una lista a mano no cubre
lo que se agrega después: por eso las 29 huérfanas entraron sin que nada se pusiera rojo, y el propio repo ya
lo tenía anotado para cuatro de ellas (`app/admin/dev/ads-writer/bitacora.ts:218`: «no aparecen, no se pueden
editar, y el compilador no lo ve»).

**Lo obvio que no alcanza:** la skill `verify-prompt-registry-sync` ya describe los cuatro modos de falla
exactos. Es MANUAL: corre cuando alguien se acuerda de invocarla, y nada la dispara al pushear. Una skill no
es una guarda.

**La regla que queda:** después de tocar un prompt, los slots de la plantilla, el `variables:` de la Entry y
las keys del objeto que recibe `renderPrompt` se comparan a mano (la skill), **y el test de ese prompt los
compara solo** — como hacen `tests/offer-ia-cableado.test.ts` y, desde el 6/11,
`tests/closing-taxonomia.test.ts`. Un prompt nuevo sin ese test entra mudo y nadie se entera.

**Sin hacer:** el chequeo que falta es uno que recorra el `REGISTRY` entero en vez de una lista por feature.
Tiene una trampa que hay que resolver antes: el cruce ingenuo da ~45 falsos positivos porque muchas keys
llegan por indirección en tabla (`lib/editor-video/chat-prompts.ts:13` → `{ key: 'video_editor.chat.system' }`,
`lib/editor-landing/ia-reglas.ts:1446`), y hay entradas muertas a propósito y documentadas
(`mako.modo.*`, `lib/prompt-registry.ts:199`). Vive en `lib/prompt-registry.ts` + `scripts/guardas-push.sh`.
## La guarda del registro de prompts: el cruce ingenuo no daba 45 falsos positivos, daba 5 (6/11/2026)

Sigue a «Ninguna guarda del pre-push mira el registro de prompts», que midió el agujero. Esto es lo que se
aprendió al taparlo con `scripts/prompts-registro-sincronizado.mjs`.

**El diagnóstico obvio era el equivocado, y es lo que hacía parecer caro el arreglo.** Se dio por hecho que
cruzar el `REGISTRY` contra los call-sites era inviable porque muchas keys llegan por INDIRECCIÓN en tabla
(`PROMPTS_CHAT_VIDEO.system.key`, `PROMPTS_EDITOR.esquemaUser.key`) o por constante (`CLAVE_PROMPT_EDITAR`),
y que resolver eso pedía seguir el flujo de datos: ~45 keys «sin call-site» que sí están cableadas. **No hace
falta resolver nada: la tabla escribe el literal igual.** Buscar la key en TODO el árbol (`lib/ app/ scripts/`)
en vez de en el primer argumento deja **5 candidatos, no 45**. Y de esos 5, cuatro son un bug de verdad y el
quinto fue lo que enseñó cómo se mide esto:

- `mako.fase.experimentos`: no era un prompt muerto sino un error de la medición. **La `key` del registro es
  el identificador con el que se LEE un prompt sólo cuando `source: 'override'`** (`overrides[e.key]`): para
  `persona`, `modo` y `fase` la pantalla resuelve por **`storeKey`** (`modoByKey.get(e.storeKey)`,
  `fases[e.storeKey]`, lib/prompt-registry.ts:1642-1646) y `lib/mako-fases.ts:21` arma la clave de
  `app_settings` como `mako.fase.${storeKey}`. Pedirle un literal en el código a la `key` de esas 167 entradas
  no mide nada: NINGUNA fase se pide por su key, y las otras cinco sólo «aparecían» porque una lista de
  `app_settings` a copiar las nombra (`lib/datos-mau.ts:346`). El modo (a) se restringió a los `override` —
  una excepción MENOS y las 4 reales intactas— y la red equivalente para las otras fuentes es que su
  `storeKey` exista en `MODOS` (`lib/mako-prompts.ts:27`): sin esa fila, `modoByKey.get()` da `undefined`, la
  pantalla muestra el default como si fuera el valor vigente y guardar escribe donde nadie lee. Hoy: 0.
  (Y por lo mismo, `mako.modo.*` NO es medible por este modo: que «no esté cableada al chat» es una propiedad
  del chat, no del registro, y vive donde el repo ya la puso — el `context` de la Entry.)
- **`campaign.{suggest,adjust}.{system,user}`: muertas de verdad.** `lib/campaign-structurer.ts` exporta los
  cuatro `CAMPAIGN_*_TEMPLATE` y **el único que los importa es el registro**; la feature `campaign-suggest`
  está en `lib/model-catalogo.ts` y ningún archivo la llama. Se editan en /configuraciones y no cambian nada,
  y su `context` promete lo contrario («No borres los slots {{metodologia}}/{{objetivos}} … o el modal de
  revisión deja de poder leer la propuesta»). Peor que las 29 huérfanas: éstas *parecen* editables.

**El registro se puede EJECUTAR, y nadie lo estaba haciendo.** `lib/prompt-registry.ts` es `server-only`, y
por eso los cinco tests que lo cruzan hoy lo leen como TEXTO con regex. Con el parche de `Module._load` que ya
usa medio `tests/` (molde: `tests/alta-cliente.test.ts`) se importa y se leen `key`, `variables` y `default`
como datos: el cruce de slots pasa de aproximado a exacto, y las 173 entradas salen solas en vez de contarse a
mano. Cuesta ~10 s de arranque.

**Las cuatro direcciones del cruce de slots NO son simétricas, y mezclarlas es lo que apaga una guarda.**
Medido sobre las 173 entradas y 89 call-sites legibles:

| Dirección | Hoy | Qué significa |
|---|---|---|
| el call-site pasa una clave que el template no tiene | **0** | el dato se tira sin error |
| el `variables:` declara un slot que ni existe ni se llena | **0** | la pantalla promete lo que no hay |
| el call-site LLENA un slot que el `variables:` no declara | **5** entradas, 13 slots | el que edita puede borrar un dato vivo sin aviso |
| un slot que NADIE llena | **6** | **puede estar bien**: viaja literal al modelo |

Las tres primeras bloquean. La cuarta **avisa y deja pasar**, porque `{{...}}` tiene DOS dueños: `renderTemplate`
y los placeholders de lead y de plantilla de WhatsApp, que el modelo tiene que copiar tal cual
(`{{nombre}}`, `{{1}}`, `{{lead_nombre}}`; `lib/paso-ia.ts:31` lo dice al lado del prompt). Los 6 casos de hoy
son todos ésos. Frenar ahí sería frenar por algo correcto, y de un candado sin llave sólo se aprende a saltearlo.

**Tres trampas que cada una fabricó un veredicto falso mientras se escribía la guarda:**

- **El shorthand de propiedad da un VERDE falso.** `renderPrompt(k, TPL, { titulo, contexto })` no tiene ningún
  `clave:`, así que un parser que busca `(\w+):` lee «no pasa ninguna clave» y **ninguna comparación falla
  nunca**. La primera medición dio 0 descartadas por eso, no porque estuviera limpio. Las claves se sacan
  partiendo el objeto por comas a profundidad 0 y aceptando `k:` y `k` solo.
- **Barrer constantes por el NOMBRE trae otros dominios.** Resolver todo `const CLAVE_*|KEY_* = '…'` del repo
  metió 60 keys de `app_settings` (`recorridos`, `resend_reply_to`, `vigia.paneles`…) y las contó como prompts
  huérfanos. Se resuelve SÓLO el identificador que aparece de verdad como primer argumento.
- **La prosa que nombra `renderPrompt(` cuenta como call-site.** Las bitácoras de `/admin/dev` son documentación
  escrita en `.ts`: una de ellas menciona la función dentro de un string y el regex la leyó como una llamada con
  una key opaca. Un argumento que no es un identificador ni un acceso a propiedad no es una llamada.
- **Y la cuarta la encontró la guarda sola, en su primer pre-push de verdad: se acusó A SÍ MISMA.** Vive en
  `scripts/`, o sea dentro de lo que barre, y sus listas de excepciones NOMBRAN las keys que persigue: contó sus
  propias cuatro `campaign.*` como cableadas («excepción vencida» ×4) y leyó el `renderPrompt(p.key…)` escrito
  dentro de un string de `INDIRECTOS_DECLARADOS` como un call-site opaco. **Ninguna guarda que barra el repo
  puede juzgar su propio archivo**: su texto habla justo de lo que caza, y el filtro de «esto es prosa, no una
  llamada» no la salva porque `p.key` sí parece un acceso a propiedad. Se excluye con una ruta DERIVADA de
  `import.meta.filename`, no escrita a mano: hardcodeada deja de excluir nada el día que el script se renombra.
  Vale para `claves-en-el-diff.mjs`, `rutas-windows-en-tests.mjs` y cualquier guarda nueva que barra texto.

**Lo que se midió y da 0, para que nadie lo vuelva a sospechar:** el cableado se busca en el fuente SIN
comentarios, pero una key nombrada dentro de un STRING (las bitácoras de `/admin/dev` son documentación escrita
en `.ts`) también cuenta como cableada y podría tapar un prompt muerto. **Entradas del registro que sólo una
bitácora nombra: 0.** No hace falta excluirlas, y excluirlas tendría su propio costo: `app/admin/dev` también
tiene código.

**La regla que queda:** en AGENTS.md → «Un prompt nuevo se DECLARA en el registro». Y el método, que vale para
cualquier guarda sobre todo el repo: **antes de dar por imposible un cruce por indirección, probá buscar el
literal en todo el árbol** — el valor suele estar escrito en algún archivo, aunque el call-site no lo tenga.

**Lo que la guarda NO mide, dicho para que nadie lo suponga cubierto:** de los cuatro modos de falla que
describe la skill `verify-prompt-registry-sync`, cubre el 1 y el 2. El **3** —que el `default:` de la Entry y
el fallback del call-site sean la MISMA constante— no: la guarda tiene el TEXTO del default, no el nombre de la
constante que el call-site pasa, así que no los puede cruzar sin volver a regexear el fuente del registro; hoy
lo fija a mano el test de cada feature. El **4** —`contenidoNoConfiable` faltante— es un juicio sobre qué dato
es externo. La skill quedó apuntada a la guarda y con esos dos marcados como suyos.

**Sin hacer, y a propósito:**

- **Las 29 huérfanas siguen afuera del registro** (lista `HUERFANAS_CONOCIDAS` en la guarda, con fecha). Se
  eligió guarda primero y registro después: registrar 29 prompts no es mecánico (cada uno pide `label`,
  `context`, `scope` y `sensitive`, que son decisiones de producto que el dueño lee en la pantalla), y sobre
  todo **sin la guarda puesta la huérfana número 30 nace mañana**; al revés no se gana nada, porque durante esa
  punta nada la impide. La guarda no puede frenar por 29 prompts que el que empuja no puso.
- **Las 4 `campaign.*` muertas** (`MUERTAS_CONOCIDAS`): se cablean, se sacan, o su `context` dice que no están
  cableadas. Las tres salidas son decisión de producto.
- **Los 13 slots vivos sin declarar** (`SIN_DECLARAR_CONOCIDOS`): `setting.ensayo`, `guardian.debate.system`,
  `guardian.proj-debate.system`, `plan-fathom.extraer.{system,user}`. Declararlos toca el registro, así que van
  con las 29.
- Las tres listas son excepciones que **sólo pueden bajar**: la guarda da rojo si crecen o si una entrada queda
  vencida (se arregló y nadie la sacó de la lista).

## La prueba de una guarda no puede vivir en el scratchpad: dos días después no existía (8/11/2026)

**El síntoma.** La guarda del registro de prompts se entregó el 6/11 «probada rompiéndola: 17 roturas, las
17 cazadas». El 8/11, `git grep -l prompts-registro-sincronizado -- tests/` daba **0**: el arnés vivía en el
scratchpad de la sesión, y el scratchpad se borra. Quedaron los `.log` con el resultado, que no prueban nada
— son la palabra de un agente sobre un archivo que ya no está.

**Por qué en una guarda duele más que en otro código.** Una guarda falla en silencio hacia el lado bueno: si
alguien «simplifica» un parser, deja de ver call-sites y sigue dando EXIT 0. Verde midiendo nada, que es
exactamente la falla que ella existe para cazar. Un pase no distingue «está sincronizado» de «no miré», y el
6/11 eso ya había pasado una vez (la primera medición dio 0 porque el parser no veía el shorthand).

**La regla que queda.** Los parsers de una guarda van en un módulo aparte y puro
(`scripts/prompts-parseo.mjs`) y un test del repo los ROMPE: `tests/guarda-registro-prompts.test.ts`, 18
casos, cada uno una rotura que de verdad pasó. Dos de los 18 no son del parser sino del cableado, y son los
que impiden que el test se vuelva decorativo: que la guarda **importe** esos parsers y no tenga una copia
propia adentro, y que `guardas-push.sh` siga llamándola y cortando el push. Apagarla ahora obliga a borrar un
test. Corre en milisegundos y no necesita `tsx` ni el registro, porque los parsers no leen disco ni git.

**El diagnóstico obvio que estaba mal.** Escribiendo el test, ``clavesDeVars('{ a: `${x}, ${y}`, b: 1 }')``
devolvió `['a','…','b']` y pareció un bug: el contador de profundidad cuenta `{` y `}`, y en
`` `${x}, ${y}` `` el `${x}` ya cerró cuando llega la coma, así que parte el objeto por el medio. **No es un
bug**: el `…` manda TODO el call-site al tercer estado (NO MEDIBLE, aviso visible) en vez de inventar una
clave o de callarse. El límite es real y ahora está escrito en el test. Lo que **sí** estaba mal era el
aviso: decía «spread o clave computada» y mandaba a buscar un spread que puede no existir. Ahora nombra las
tres causas. Un aviso que miente sobre la causa gasta el tiempo de quien lo lee, que es como se apaga una
guarda.

**La trampa del entorno, y es silenciosa.** Mover las funciones con un heredoc de Bash les comió los
backslashes: `\\b` quedó `\b`, y dentro de un **template literal** `\b` no es un borde de palabra, es un
backspace. Los regexes quedaron basura, `node --check` pasó igual (es sintaxis válida) y la guarda arrancó y
dio rojo con 28 «KEY QUE NO SE PUEDE SEGUIR» falsas. Para mover código entre archivos se copian los BYTES
con `git show HEAD:<archivo>` y se compara función por función contra el original; no se transcribe por
heredoc. Hecho así, la guarda volvió a dar los mismos números exactos.

**Lo que la guarda midió sola, sin que nadie la tocara (8/11).** 226 commits ajenos después de su merge,
sobre el árbol de `origin/main`: verde, cero falsos positivos, y el registro creció de 173 a **179 entradas
en 36 grupos** (keys que el código pide: 177 → 183). Seis prompts nuevos de otras puntas, bien declarados y
medidos sin ayuda. Era la pregunta del pedido —«una guarda que no resuelva eso es ruido y la van a apagar»—
y la respuesta, medida: no se volvió ruido.

**Sin verificar en esta máquina.** Las 259 barredoras corrieron y dieron `✖ ROJO · 354 tests · RAM libre
mínima 0.0 GB`, con ~230 archivos en rojo. Es la RAM, no el código: correr 259 archivos juntos en esta PC
agota la memoria y los mata en masa, así que ese rojo no dice nada sobre el código (ver
[hallazgos-pruebas.md](hallazgos-pruebas.md) y el «0 tests» de la memoria). Los que sí podrían ser por estos
archivos pasan de a uno: `git-lista-entera-buffer`, `ls-files-con-tope`, `rutas-windows-en-tests`.
`tipos-ci` no se corre acá —es el `tsc`, lo mata la guarda de RAM— y lo corre GitHub.

## «No tengo acceso a Google Calendar» con la agenda conectada: nombrar el LUGAR no traía la herramienta (ticket #42, 3/11/2026)

**Síntoma (Código Inmobiliario, en su grupo):** MaKo dijo «no tengo acceso a crear eventos en tu Google Calendar» y dos renglones
más abajo «después yo lo creo en tu Google Calendar». El negocio la tiene conectada desde el 8/10.

**El diagnóstico obvio era el equivocado:** se buscó si `crear_evento_google` llegaba por WhatsApp o si faltaba el rol. El rol no
pesa en el grupo: el turno corre siempre con `rol: 'admin'`, a propósito. Crear el evento andaba: «crea un evento en mi Google Calendar
mañana a las 9» ya traía `proponer_agendar_agenda`. Lo roto era todo lo demás:
- «google calendar» sólo prendía el área `integraciones`, así que sin `crm` no viajaba ninguna herramienta de agenda.
- «agrégalo a mi google calendar» caía en charla, sin una herramienta. Y la clase de la IA no lo salva: `veredictoDeClase` toma las
  áreas de `areasDelMensaje`, la misma rueda.
- En una pregunta las que escriben no viajan, y por WhatsApp no existe la línea de `ofrecibles` de la app: el modelo deducía el «no
  puedo» de lo que le llegaba.

**La regla:** lo que MaKo puede con una cuenta conectada se le dice como un HECHO con el estado real
(`hechoGoogleCalendar`, lib/agenda-sin-ia.ts), y si falta algo dice CUÁL: la conexión, el permiso o el rol.

**Trampa:** `crear_evento_google` proponía sin mirar la conexión y fallaba recién con el «sí». Ahora mira `agendaParaEscribir`
(lib/google-calendar.ts) antes de proponer, la misma que usa `proponer_agendar_agenda`.

**Sin hacer:** por WhatsApp sigue sin viajar `lineaDeOfrecibles` para el resto de las áreas (lib/doer-herramientas.ts): el mismo
«no puedo» falso puede salir en una pregunta sobre otra cosa. No se tocó porque la línea cambia todos los turnos del grupo. **No se leyó
la conversación del grupo** de ese día: la lectura de `mako_doer_conv` quedó frenada por los permisos de este chat; la causa sale del texto
del ticket y de correr el turno con esas frases.

## `hace[]` del catálogo no le llega a ningún cliente (ticket #45, 3/11/2026)

**Síntoma (Leila):** «Activa la función "Aprende solo" en el Second Brain» y MaKo contestó que eso no existe.

**El diagnóstico obvio era el equivocado:** `1efb12f08` corrigió el nombre en `hace[]` (lib/funciones-mako.ts), y el ticket quedó dado por
resuelto. `hace[]` sólo lo leen la capa exclusiva de la plataforma (lib/cerebro-funciones.ts) y /admin/docs; `listar_capacidades_mako` no lo
devuelve. Probado en el negocio de la plataforma, «anda».

**La regla:** para que MaKo sepa algo un cliente, va en `lib/mako-capacidades.ts` con su link, y si se puede hacer, con una operación y su
familia en lib/mako-intencion-app.ts. Y se prueba en un negocio que NO es la plataforma.

**Sin hacer:** el resto de `hace[]` sigue igual: lo que está sólo ahí MaKo no se lo sabe decir a un cliente.

## «El respaldo de Automations es Gemini»: el orden ya era el pedido, faltaba decir quién contestó (27/10/2026)

El Cerebro (876825880-04): «primero la IA que eligió el admin del negocio; Gemini sólo como último respaldo, y el chat dice
qué IA contestó». **El obvio, «cambiar el orden de la cascada», era el equivocado.** `chatCheapCascade` (lib/ai-cheap.ts) ya
va en este orden: su Claude, sus claves (con D6b: su ChatGPT y su Gemini), el crédito de Claude y la red de MaKo al final.
Gemini ya queda último para quien eligió otra IA.

**Lo que faltaba era decirlo:**
- `quienOut` (opcional) anota el proveedor y de quién era la cuenta en cada `return t` de la cascada;
- `textoDeQuienContesto` (lib/quien-contesto.ts) lo pasa a palabras;
- el globo de MaKo de Automations lo dibuja al pie: «Con tu Claude», «Con el crédito de Claude de MaKo», «Con la Gemini de
  MaKo (respaldo)».

**«Con tu X» es honesto** porque `provsDe` ya saca, con `soloLasPropias`, las «propias» que son copia de una clave de la
plataforma.

**La regla:** un `return t` nuevo en la cascada lleva su `anotarQuien` (tests/automations-quien-contesto.test.ts los cuenta:
5).

**Sin investigar:** el 26/10 a las 23:38Z, el chat del lienzo del ws9 (#700, «Una Cuota Venció») contestó dos veces «Gemini
está saturado. Prueba en un rato.». En esa hora, el ws9 sólo registra IA de Gemini (dictado y Landing Analyst). Falta saber
por qué ese pedido no cayó al crédito de Claude.

## «La reunión es a las 11 y MaKo dice 10»: la ficha que lee MaKo no traía la hora (30/10/2026, el ticket #35, claude3)

**Vive en:** `horasDeLasReuniones` / `horaEnLaZona` (lib/mako-ficha-lead.ts) · `resumenLead` (lib/mako-tools.ts: `buscar_leads` y
`ficha_lead`).

- **El síntoma:** Código Inmobiliario (ws13) le pidió a MaKo en su grupo «la fecha, horario y datos de contacto» de dos leads, y las
  dos salieron «a las 10:00»; eran a las 11 y a las 15.
- ⚠️ **El diagnóstico obvio era el equivocado.** 11 → 10 parece la zona horaria, pero 15 → 10 no. La base estaba BIEN (`junta_1_at`
  14:00Z y 18:00Z, la zona del negocio Buenos Aires). `fecha_junta_1` es un DATE (sólo el día) y la hora vive en `junta_1_at`;
  `resumenLead` pasaba sólo el día, y el modelo completaba «10:00» (el ejemplo de hora de varias herramientas es «10:00»). La
  herramienta de las reuniones (`reuniones`) ya ponía la hora en la zona del negocio; la ficha no.
- **Por qué no lo frenó la red:** `numerosSinFuente` (lib/doer-salida.ts) no mira las HORAS a propósito (en las herramientas van en
  UTC y el modelo las pasa a la zona), así que una hora inventada sale. **La regla:** todo dato con hora que se le pasa al modelo va
  YA en la zona del negocio, y si no hay hora, una nota de que no hay; un DATE solo, al lado de «fecha y horario», se completa.

## El buscador de conocimiento sin Gemini: con la IA del negocio, o por palabras (25/10/2026)

El Cerebro, 25/10/2026, cerrando la excepción que había quedado abierta (abajo, «Ningún cartel le ofrece Gemini»): «Embebe
con la IA del negocio que la tenga: su OpenAI (text-embedding-3-small, 1536) primero, su Gemini si es lo único que tiene. Sin
ninguna de las dos, búsqueda por palabras (la de Postgres), nunca la Gemini de la plataforma y nunca "conecta tu Gemini". Cada
fila guarda con qué se embebió. Una pregunta sólo se compara contra filas del mismo modelo, y el resto se re-embebe solo, de a
poco, cuando el negocio conecta su IA».

**El síntoma:** un negocio con sólo su GPT no tenía buscador —ni de lo suyo ni del método de MaKo—, sus filas quedaban en
`error` con «Conecta tu Gemini en Integraciones…» y el Second Brain («Aprende solo») le decía «conecta tu Gemini».

**Cómo quedó:**
- Embebe `embebedorDelNegocio` (lib/embeddings.ts): su OpenAI, si no su Gemini, si no `null`. En la plataforma (ws9) y para el
  método de MaKo (`deMako`), la Gemini de la plataforma, como desde IA16: es contenido de MaKo, no del negocio.
- Sin su IA NO es un error: `embed` tira `SinEmbebedor`, la fila queda `pendiente` con `POR_PALABRAS` en el campo `error`
  («Se busca por palabras hasta que conectes tu GPT.») y `falloDelRag()` queda en null.
- `searchKnowledge`: por vector, sólo las filas del MISMO modelo que la pregunta (coseno > 0,15); después, las demás —sin
  vector o de otro modelo— por palabras (lib/conocimiento-palabras.ts, umbral 0,25). Completan, no compiten con el coseno.
- Re-embeber: `reembeberLoQueFalta(limite)` toma lo del negocio sin vector o con el de otro modelo, de a `limite`. Lo dispara
  guardar su OpenAI o su Gemini (lib/reembeber-al-conectar.ts: tandas de 40, hasta 40 s) y el GOTEO de cada búsqueda.

**Lo que no se ve:**
- ⚠️ **El diagnóstico obvio («re-embeber también el método de MaKo en OpenAI») era el equivocado.** Habría que pagarlo con la
  OpenAI de la plataforma (sin crédito desde el 04/10) o con la del negocio (contenido de MaKo en su cuenta, una copia por
  negocio). Un negocio que embebe con su OpenAI encuentra el método **por palabras**: el método sigue en Gemini.
- ⚠️ **`.not('embedding', 'is', null)` en la consulta dejaba afuera, para siempre, lo que no tenía vector.** Sin su IA el
  buscador volvía vacío con 119 filas cargadas. Salió: lo sin vector es justo lo que se busca por palabras.
- ⚠️ **Guardar la clave no alcanza para «el resto, solo»:** un negocio que YA tenía su GPT no la vuelve a guardar, y sus filas
  (las que IA16 dejó en `error` por no tener su Gemini) se quedarían por palabras para siempre. Por eso el goteo
  (`gotear`, lib/mako-knowledge.ts): una búsqueda que ve filas del negocio sin el vector de su IA re-embebe 10, con `after()`,
  una vez cada 10 minutos por negocio y proceso. Sin pedido en curso `after` tira y no corre: lo hace la próxima búsqueda.
  Las filas que ya fallaron van al final de cada tanda: si no, una que falla siempre se quedaba con el lugar de las demás.
- ⚠️ **Re-indexar sin su IA no borra un vector que todavía es de ESE texto** (`content_hash` igual): sigue sirviendo con su
  modelo. El de un cuerpo que cambió sí sale (si no, la pregunta se compararía con el texto viejo).
- **«La de Postgres» va en la app, no en Postgres:** las filas ya vienen en la consulta (las de UN negocio más el método, pocas)
  y así la regla se prueba con datos de mentira. Si el conocimiento de un negocio pasa a miles de filas, pasarla a
  `to_tsvector` con su índice (otra migración).
- **La migración es la 0337** (supabase/migrations/0337_mako_knowledge_modelo.sql: `embedding_modelo` + marcar las filas con
  vector por su largo), APLICADA a mano en producción el 25/10/2026 20:56 (el Cerebro, con el sí de Martín): 77 filas de
  1536 (las de OpenAI de antes del 22/10) quedaron en `text-embedding-3-small`, 42 sin vector en null, ninguna de 768. El
  código anda también sin ella (una base local o de prueba): el select contesta 42703 y el PATCH, PGRST204; lo detecta, deja de pedir la
  columna en ese proceso y el modelo sale del largo (`modeloDelVector`).
- El PostgREST de mentira (tests/_postgrest-de-mentira.ts) acepta CUALQUIER columna: «sin la migración» no se ve si no se
  simula (`sinColumna` en tests/_ia16-hijo.ts).
- El «buscar con MaKo» del Second Brain (app/api/second-brain/buscar) NO es este buscador: es la cascada sobre el mapa, y su
  texto (`conSuIASinClave`) ya pide su Claude o su OpenAI. La advertencia de abajo sobre él quedó sin objeto.

**Vive en:** lib/embeddings.ts, lib/conocimiento-palabras.ts, lib/mako-knowledge.ts (`embedRow`, `reembeberLoQueFalta`,
`gotear`, `searchKnowledge`), lib/reembeber-al-conectar.ts (`EMBEBEN`, `reembeberAlConectarSuIA`),
app/api/integraciones/credencial/route.ts, app/second-brain/AprendeSolo.tsx y scripts/reembeber-conocimiento.mts (ya no hace
falta correrlo: el goteo hace lo mismo solo). Tests: tests/ia16-cada-uno-su-ia.test.ts (4, 6, 7 y 9) y
tests/conocimiento-sin-gemini.test.ts. Probado rompiéndolo (25/10/2026): 18 roturas, una por vez (su OpenAI no va primero, la
Gemini de la plataforma sin su IA, el coseno entre modelos, vuelve el `.not`, sin palabras, «sin IA» como fallo, re-indexar
borra un vector que sirve, el cuerpo cambiado conserva el viejo, sin «de a poco», no re-embebe lo de otro modelo, sin tolerar
la base sin la columna, al conectar sólo su Gemini, «conecta tu Gemini» en «Aprende solo» y en el texto, sin goteo, el plural,
el saludo y las que fallaron adelante): todas rojas, y todo verde al restaurar.

**Sin hacer:**
- El goteo no se prueba en un pedido real (el hijo no tiene `after`): lo fija el test de fuente. Medirlo en producción con el
  log `[conocimiento] ws N: re-embebí … (goteo)`.

## «No es seguro», el instalador con la marca y «Conecta MaKo» sin texto (MaKo Desktop, 25/10/2026)

Martín, 25/10 ~11:30: «me dice que no es seguro, que podemos hacer para que no salga eso? Y el instalador de MaKo debe estar
personalizado con el diseño de mako... En "tus cuentas de IA" cuando le doy a conectar... rediseña eso, que se vea facil, mira
la cantidad de texto».

**La firma NO saca el aviso de un día para el otro (el diagnóstico obvio era el equivocado).** «Firmamos y listo» es falso:
- SmartScreen («Windows protegió su PC») mira la reputación del ARCHIVO (su hash) y la del CERTIFICADO. Con la firma IV, el
  cartel pasa a decir «Editor: Martín Koncke» en vez de «Editor desconocido», pero **sigue saliendo** hasta que el certificado
  junta reputación. Microsoft no da un número: «varias semanas y cientos de instalaciones limpias»
  (learn.microsoft.com/windows/apps/package-and-deploy/smartscreen-reputation). En un foro, un OV nuevo siguió bloqueado 7
  semanas y se destrabó a los ~7 meses (forum.xojo.com, 2025-2026). Lo que ayuda: firmar TODAS las versiones con el mismo
  certificado (las nuevas heredan la reputación), no tocar el archivo después de firmar, y mandar el instalador a
  microsoft.com/wdsi/filesubmission como «Microsoft Defender SmartScreen» si el aviso es incorrecto.
- **EV ya no sirve para esto:** desde 2024 un certificado EV dejó de dar reputación instantánea («all Code Signing certificates
  will be treated equally», learn.microsoft.com/security/trusted-root/program-requirements). Comprar el EV caro no lo acelera.
- **Azure Artifact Signing (ex Trusted Signing) no es para Martín:** a personas sólo en EE. UU. y Canadá.
- **El aviso de Chrome es otro** («archivo sospechoso», Safe Browsing por reputación de descarga): Google no publica que un
  certificado nuevo lo saque, ni hay formulario para un archivo «poco común» (el de Safe Browsing es para páginas).
- **Smart App Control** (Windows 11 nuevo) BLOQUEA un .exe sin firma y sin reputación: ahí no hay «Ejecutar de todas formas».
  Es la razón más fuerte para firmar aunque el aviso tarde en irse.
- **Desde marzo de 2026 un certificado dura como máximo 460 días** (SSL.com: 458): hay renovación todos los años, y no está
  documentado que la reputación pase al certificado renovado.
- Lo que SÍ evita SmartScreen es publicar en la Microsoft Store (cuenta individual gratis desde el 10/09/2025, acepta un
  .exe firmado, sin el cartel al instalar desde la Store); no cambia nada para quien baja de hola-mako.com. Sin hacer.
- **Mac:** sin firmar ni notarizar, en Sequoia ya no anda «clic derecho › Abrir»: Ajustes › Privacidad y seguridad › «Abrir
  igualmente» (support.apple.com/102445). Firmada con Developer ID y notarizada, un «¿Abrir?» común. Un .zip no se engrapa: se
  engrapa la app y se zipea después (lo hace `publicar-binarios`); sin engrapar, la Mac busca el ticket en internet.

**Verificar la firma es lo que dice WINDOWS, no que el .exe tenga una firma.** `peFirmado` sólo mira que haya una tabla de
certificados; un certificado sin cadena, vencido o un archivo tocado después la tienen igual. `verificarFirmaWindows`
(`Get-AuthenticodeSignature`) mira `Valid`, el editor y la marca de tiempo, y `publicar-binarios` no sube sin las tres. Medido
en esta PC: el `ISCC.exe` de Inno da «Pyrsys B.V., con marca de tiempo»; nuestro instalador, `NotSigned`. Dos trampas: la ruta
va por el entorno (con comillas o «Muñoz» en la línea se rompía) y PowerShell 5.1 escribe en la página de códigos OEM: sin
`[Console]::OutputEncoding = UTF8`, «Martín» llega como «Mart¡n».

**El asistente de Inno con la marca (Inno 6.7 en esta PC).** Se copió la estructura de VS Code (que también es Inno: la imagen
grande en la bienvenida y el final, la chica arriba, en siete tamaños, y el ícono propio), con la criatura y el logo sacados del
código de la marca (`scripts/ia-pc/marca.mjs`, sin dibujar nada a mano). Lo que no se ve en el código:
- **`DisableReadyPage=yes` NO cambia «Siguiente» por «Instalar»** en la página anterior (lo dice la ayuda): hace falta el
  `[Code]` de `CurPageChanged`. Sin eso, la bienvenida decía «Siguiente» y el toque instalaba.
- **Inno 6 trae `DisableWelcomePage=yes` por defecto:** la página de la imagen grande no salía. Y el `Spanish.isl` de fábrica
  habla de usted («Haga clic en Siguiente…», «en su sistema»): todo texto que se ve está pisado en `[Messages]`, también
  `ClickNext`, que aparece en la bienvenida aunque no esté en la lista de lo que uno cambia.
- ISCC lee el .iss en UTF-8 sin BOM (los «¡» y las tildes salen bien), y desde la 6.6 acepta PNG con transparencia.
- **El instalador de verdad NO se corre en esta PC** (cierra `mako-pc.exe` del ws1 y toca el registro): `/DVista` arma las
  mismas páginas sin archivos, registro, accesos ni programas, y `scripts/ia-pc/vista-instalador.ps1` las fotografía fuera de
  la pantalla. Dos trampas de esa foto: PowerShell le pasa `""` (no null) a un string `$null` y `FindWindow` no encuentra nada
  (`[NullString]::Value`), y sin `SetProcessDPIAware` la foto sale recortada con la pantalla al 125 %.

**«Conecta MaKo» con un botón (la página de Zoom).** El código no se muestra: el botón «Conectar» ES el «acepto» (el texto va
abajo) y abre `mako://conectar` solo; si vence o la persona dice «No», el mismo botón pide otro. Lo que costó:
- Para mirar la pantalla sin `next dev` (la RAM no da), un esbuild de `TusCuentasIA` con la API simulada. **El `mako://` de esa
  vista le llegaba a la app de ESTA PC** (la del ws1, que lo tiene registrado): la vista va en un `<iframe sandbox>` sin
  `allow-popups` ni `allow-top-navigation`, y Chrome no deja salir un protocolo externo de ahí (medido: ningún `mako-pc` nuevo).
  `ConectarIntegracion` arrastra server actions al bundle: en la vista se reemplaza.
- **En la Mac el `mako://` no le llega al programa** (MaKo.app es un guion, no recibe el Apple Event): el botón deja el código
  en el portapapeles. Safari exige que esa escritura salga DEL toque, y el código llega después de un fetch: va un
  `ClipboardItem` con la promesa adentro. Sin permiso (el iframe de la vista), cae a mostrar el código con «Copiar».
- Las ventanas de la Mac llevan el ícono de MaKo (`with icon (POSIX file …)`). **Sin probar en una Mac:** si el ícono hace
  fallar la ventana por otra cosa que «Cancelar» (-128), se repite con el genérico; una ventana que no sale es un «No».

**El grupo de WhatsApp del dueño a su computadora: la prueba es el TELÉFONO, y la hace la puerta** (rama `desktop-api-2510`,
`encolarTurno` con `delGrupo`; docs/conexiones-y-ayuda.md, decisión 2). El doer corre en un after() del webhook, sin cookie,
así que `laPersonaEstaAdentro` no sirve. La prueba: el teléfono que manda WhatsApp (nunca un @lid, un jid ni un «whatsapp:…»)
es de UNA sola persona ACTIVA del negocio, comparado con `mismoContacto` (el 9 de Argentina y el 1 de México cambian la forma),
y esa persona es la que conectó la PC. Dos del equipo con el mismo número no son nadie. Va ADENTRO de la puerta y no en el doer,
por lo mismo que la cookie: la refutación de D6a mostró que una guarda en quien llama se saltea con un alias.
`tests/ia-pc-puerta-grupo.test.ts`. Quien llama (el doer) es de «MaKo en WhatsApp».

**Lo que quedó SIN hacer:**
- Publicar la 0.4.3 (la marca, el ícono de la Mac y lo de la llamada con Leandro): `VERSION_PC` y `VERSION` juntos, y
  `publicar-binarios --aplicar` ANTES de desplegar; los pasos en `docs/relevo/mako-desktop.md`.
- El ícono del PROGRAMA (`mako-pc.exe`, el de Bun): los accesos y «Aplicaciones instaladas» usan `mako.ico`, pero el .exe trae
  el genérico. `bun build --windows-icon` no se probó (el `--windows-hide-console` de Bun 1.2.21 no andaba).
- Un `.dmg` con fondo («arrastra MaKo a Aplicaciones») no se arma en Windows; y que el `mako://` le llegue a MaKo.app pide un
  ejecutable que reciba el Apple Event (`CFBundleURLTypes` solo no alcanza con un guion).
- La Microsoft Store como segundo canal sin SmartScreen.

**Vive en:** `installer/windows/mako.iss` · `installer/marca/` (de `scripts/ia-pc/marca.mjs`) · `scripts/ia-pc/vista-instalador.ps1`
· `scripts/ia-pc/firmar-windows.mjs` (`verificarFirmaWindows`, `verificar <archivo>`) · `app/integraciones/TusCuentasIA.tsx`
(`Tutorial`) · `lib/ia-pc-reglas.ts` (`abreEnlacesMako`, `ICONO_APP_MAC`) · `scripts/ia-pc/mako-pc.mjs` (`dialogoMac`) ·
`tests/ia-pc-marca.test.ts`, `tests/ia-pc-firma.test.ts` (5), `tests/ia-pc-instalador-040.test.ts` (1)

## El grupo de MaKo del dueño, a su computadora: la otra prueba de identidad (25/10/2026)

Martín, 25/10/2026: «dijimos que todo eso se hace con la app de escritorio de MaKo y conectado a su claude o GPT». Decisión 2
de [conexiones-y-ayuda.md](conexiones-y-ayuda.md): el grupo de MaKo del DUEÑO es él escribiéndole a su MaKo, como el chat de
la app, y contesta con su computadora. La puerta la hizo MaKo Desktop (`encolarTurno` con `delGrupo`, lib/ia-pc.ts,
lib/ia-pc-grupo-reglas.ts); el que la pide, «MaKo en WhatsApp» (`pcDeQuienEscribe`, lib/mako-doer-in.ts). Lo fijan
tests/ia-pc-nunca-a-leads.test.ts (7), tests/ia-pc-puerta-grupo.test.ts y tests/doer-cartel-sin-ia.test.ts (7).

- ⚠️ **El diseño decía «el turno va como `turnoApp`», y no encaja.** `turnoApp` es un turno de chat de la app (su sesión, su
  historial, sus herramientas); el doer tiene pendientes, borrador, agenda y su memoria. El doer conserva su turno y sólo la
  llamada al modelo va a la PC, por la misma puerta y con las mismas herramientas (`runTool` como `Ejecutor`).
- **La identidad no es la cookie: es el teléfono que manda WhatsApp** (`participant`, nunca lo que dice el mensaje), de UNA sola
  persona activa del negocio, y ésa es quien conectó la PC. Lo prueba la PUERTA, no el doer. ⚠️ Consecuencia: si el dueño no
  tiene su número en su perfil de MaKo, su computadora nunca contesta el grupo; el cartel se lo dice.
- **Un lote de varias personas no va a la PC.** El mensaje sintético del lote lleva el `participant` del ÚLTIMO: con dos
  autores, ése no prueba quién pidió lo de arriba (`loteDeVarios`).
- `sesion_id` de `ia_pc_turnos` es NOT NULL (mig 0320) y nadie lo lee: el grupo va con 0, sin migración.
- Con la PC apagada o sin contestar, el camino de siempre (su clave, si tiene); sin clave, el cartel dice qué pasó con SU
  computadora («préndela», «no me contestó a tiempo»). «Aquí no, en la app» quedó sólo para quien no la conectó.

**SIN hacer:** medirlo con una computadora de verdad (no se probó en vivo); que «Tus cuentas de IA» diga que la computadora
también contesta el grupo (es de MaKo Desktop); las notas de voz siguen necesitando su GPT (Claude no escucha).

## Lo que MaKo sabe de cómo conectar cada cosa, de un solo lugar: el prompt, las capacidades y la intención (25/10/2026)

Tanda 3 de [conexiones-y-ayuda.md](conexiones-y-ayuda.md). Vive en `lib/hechos-mako.ts`, `lib/mako-capacidades.ts`, los
`DEEP_LINKS` de `lib/mako-doer-in.ts` y `lib/mako-intencion.ts`; el catálogo es `lib/conexiones-catalogo.ts`. Lo fija
`tests/conexiones-un-solo-lugar.test.ts`.

- **El prompt le prohibía a MaKo dar el link que hacía falta.** `hechosMako` (va en TODOS los prompts) tenía tres links
  escritos a mano —meta, anthropic, landing— y la regla «no te salgas de esta lista»: MaKo no podía darle a Florencia el de
  Fathom, el de Zernio ni el de su computadora. Ahora la lista sale del catálogo (`EN_EL_PROMPT`, las once que más se piden:
  todas no, porque viaja en cada turno) y para las demás está `como_conectar`.
- ⚠️ **Trampa: el `\b` de JavaScript es ASCII.** La expresión nueva del área integraciones terminaba «conect(ar|o|é|…)\b», y
  «ya conecté instagram?» no entraba: después de una «é» no hay borde de palabra para JavaScript (sin la bandera `u`, y aun con
  ella `\b` sigue siendo ASCII). Tras una vocal con tilde va un lookahead (`(?![a-záéíóúñ])`), no `\b`.
- **«instagram» o «facebook» solos no traen el área integraciones**: van en cada pedido de anuncios, y el presupuesto del
  registro (12.000 caracteres) es uno solo; sumarle las herramientas de conectar a un turno de anuncios le saca otras. Entran por
  «conectar instagram».
- **Los textos del prompt que mandaban a «/integraciones» a secas** (dónde se pega el Pixel, dónde se cargó el píxel de Meta)
  ahora nombran la tarjeta; la guarda (test 4) barre los runners de la API, los carteles y el prompt.

**SIN hacer:** los textos de la app que nombran Gemini (lib/ia-mensajes.ts, lib/mako-turno-app-reglas.ts, lib/flujo-ia.ts y
los de MaKo Desktop) y que la app (`turnoApp`) ponga `aFalta`.

## Ningún cartel le ofrece Gemini como «su IA» (25/10/2026; reemplaza lo del 22/10)

Martín, 25/10/2026, por el audio de Florencia (ws21): «le sigue diciendo que debe conectar su IA de Gemini, cuando dijimos
que todo eso se hace con la app de escritorio de MaKo y conectado a su claude o GPT». El 22/10 (IA16) había sumado su Gemini
como «su IA»; desde hoy ningún texto lo ofrece. El plan, en [conexiones-y-ayuda.md](conexiones-y-ayuda.md); el cartel del
grupo, en [hallazgos-comunicacion.md](hallazgos-comunicacion.md) (misma fecha).

- **Qué se ofrece y dónde:** en la app, su Claude con MaKo Desktop (el chat ya exige la computadora,
  lib/chat-mako-reglas.ts); en WhatsApp y en lo que corre solo, su GPT por clave, que escucha audios y corre los turnos con
  herramientas. Un negocio que YA tiene su Gemini sigue andando con él (la cascada lo prueba): lo que no se hace es mandarlo
  a conectar uno.
- **El cartel del grupo ya lo cumple** (lib/fallo-ia-texto.ts): el test 8 de tests/doer-cartel-sin-ia.test.ts recorre las
  siete causas por cada pedido, claves, errores y contexto. **Y los textos de la app de «MaKo en WhatsApp» también** (tanda
  6): `CONECTA_TU_IA`, `FALTA_TU_IA` y el «activa la facturación de tu Gemini» (lib/ia-mensajes.ts), `conSuIASinClave` y
  `CON_SU_IA_SIN_VISION` (lib/fallo-ia-texto.ts), `AVISO_SIN_IA`, `AVISO_NO_LEI_SU_IA` y `AVISO_SIN_ARCHIVERO`
  (lib/mako-turno-app-reglas.ts). **Quedan, de otros dueños:** `SU_IA` y `SU_CLAVE` (lib/flujo-ia.ts, Automations),
  lib/ai-cheap.ts:1116, lib/persona.ts:219 y las bajadas de «Tus cuentas de IA» (lib/ia-pc-reglas.ts:890, TusCuentasIA.tsx,
  /perfil/ia: MaKo Desktop). `conSuIASinClave` también lo dice la búsqueda del Second Brain, que NO embebe: es la cascada
  sobre el mapa (app/api/second-brain/buscar), y su GPT alcanza.
- **La excepción del conocimiento, DECIDIDA el mismo día:** embebe con la IA del negocio (su OpenAI primero) y, sin ninguna,
  busca por palabras. Arriba: «El buscador de conocimiento sin Gemini».
- ⚠️ **La marca «red gratis salteada» de lib/ai-cheap.ts (≈:891 y :896) se deja sin preguntar si había red**, también
  cuando el negocio tiene su IA (`soloSuIA()`). `sinRedPorDatos` reconoce las dos, y por eso nutrición (lib/nutricion.ts)
  y el simulador de setting le dicen `CONECTA_TU_CLAUDE` a negocios que ya la tienen. Es el arreglo que el doer tuvo el
  24/10 (preguntar por la red ANTES de marcar), en otro módulo. SIN hacer.

## «¿Cómo abro MaKo?» y «quiero otra cuenta de Claude»: la app de escritorio, en la llamada con Leandro (25/10/2026)

- **f02** (Leandro, recién instalado): «¿Cómo abro MaKo? (...) Se me descargó algo, pero en la computadora no lo puedo ver». No
  era que no se instaló: `mako-pc` corre ESCONDIDO a propósito (contesta los turnos y arranca con Windows), y el instalador no
  creaba ningún acceso. Ahora deja «MaKo» en el menú Inicio y en el escritorio (`installer/windows/mako.iss`, `[Icons]`), que
  corre `mako-pc abrir`: el Ops Center del negocio conectado en el navegador, o «Tus cuentas de IA» para conectarla si no lo está.
- **f03:** «Ahí te debería dejar elegir otra cuenta, no solamente detectar la que ya está abierta». La autorización de Claude se
  abre en el navegador de siempre y Claude la da con la cuenta que ya está abierta ahí, sin preguntar. La página local de
  `mako-pc` ofrece «¿Otra cuenta de Claude?»: el MISMO enlace para abrir en una ventana de incógnito; el código se pega igual.
- **⚠️ NO llega sola a nadie:** hace falta armar y publicar la 0.4.3 (Inno Setup en esta PC, `scripts/ia-pc/publicar-binarios.mts`)
  y recién ahí subir `VERSION_PC` (lib/ia-pc-reglas.ts) y la de `mako-pc.mjs`. Subir la versión ANTES rompe «Descargar MaKo»
  (el nombre del archivo sale de `VERSION_PC`), y armar con 0.4.2 pisaría el binario publicado. La Mac (MaKo.app) no tiene
  accesos que crear: abrirla desde Finder ya hace lo suyo.

**Vive en:** `scripts/ia-pc/mako-pc.mjs` (`destinoDeAbrir`, `abrirMaKo`, `otraCuenta`) · `installer/windows/mako.iss` ·
`tests/ia-pc-abrir.test.ts`

**Lo que más muerde acá:**

- El prompt que leés en el archivo **no es** el que recibe el modelo: `brandSystem` le
  antepone el núcleo de chat, y un override guardado en la base le gana al template del
  repo → [Prompts](#prompts).
- El modelo que corre una feature **no se deduce del catálogo**: el override es global del
  ws1 y la cascada barata ni lo lee → [Modelos y ruteo](#modelos-y-ruteo).
- **Un `def` que cobra es un cobro silencioso**: `/modelos-ia` solo escribe cuando alguien
  toca el botón, así que la feature que nadie tocó paga desde el día uno. `plan-fathom`
  se comió US$37 en 30 días así, y el reclamo culpaba al Perro → [Modelos y ruteo](#modelos-y-ruteo).
- La cascada "gratis" muchas veces **le pega cuatro veces al mismo Groq** y un `validar`
  flojo la corta en el primer proveedor → [La capa barata](#la-capa-barata).
- Un `0` por fuente desconectada entra al prompt como si fuera una medición, y la IA
  dictamina catástrofe → [Lo que le llega al modelo](#lo-que-le-llega-al-modelo).
- `effort: 'low'` **no apaga** el razonamiento de Claude, y los topes de cantidad están
  escritos dos veces (en el `.slice()` y en el texto del prompt) → [Topes](#topes).
- **Un agente que no llama la tool no falla: CONTESTA.** Su prosa salía al WhatsApp del
  dueño sin ningún chequeo, y `toolsUsados > 0` no lo ataja → [El doer](#el-doer).
- El saldo y el gasto eran globales al ws1 aunque las keys ya fueran por cliente. Lo de
  Gemini se arregló; **el saldo de Claude de un cliente sin key propia todavía se lee y se
  escribe en el ws1**, que es Mauricio → [Gasto y saldo](#gasto-y-saldo).
- **Nada corta una llamada por gasto**, y el gasto de Claude no se puede atribuir a un
  cliente: las dos cosas bloquean cualquier límite por plan →
  [Gasto y saldo](#gasto-y-saldo). El análisis completo, con los números reales de
  producción, está en [costos-ia-y-planes.md](costos-ia-y-planes.md).
- **El precio que publica un revendedor de modelos es propaganda hasta que se recalcula
  contra el fabricante**, y sus términos de reventa son la otra mitad del dato: APImart
  prohíbe por escrito facturar encima y Kie.ai no dice nada, que no es lo mismo que
  permitir → [Comprar modelos](#comprar-modelos-revendedores-mercados-y-precios-de-terceros).
- **BYOK de MEDIOS está prohibido**, textual, por los dos únicos proveedores aptos para un
  SaaS (fal.ai y Replicate: «You may not share or permit others to use your individual
  account credentials») → [Comprar modelos](#comprar-modelos-revendedores-mercados-y-precios-de-terceros).
- **Un chequeo de conexión que usa otro resolver que la ruta caliente pinta verde y te cobra
  a vos**, y «el texto dejó de costar» es en parte «dejó de medirse»: 7,5M de tokens de
  clientes registrados en US$0,04 → [Gasto y saldo](#gasto-y-saldo).

Dos advertencias sobre el origen de este material. **Buena parte es de segunda mano:** sale
de lo que devolvieron los subagentes de las 261 corridas de junio-agosto 2026 (de las que
134 nunca habían escrito nada en el repo), no de una relectura del código de hoy — cada
entrada dice de qué corrida y fecha viene, y **antes de actuar sobre una, verificá contra
el código**; varias ya están arregladas y donde el rescate lo sabía, lo dice. El registro
completo de las corridas está en [corridas-multiagente.md](corridas-multiagente.md).
Y las reglas y decisiones del dueño salen de minar sus 1038 mensajes en 48 sesiones: son
sus palabras, con la fecha en que las dijo.

---

## Modelos y ruteo

### ⚠️ «Probé tus 2 cuentas y las 2 llegaron al tope de hoy», con el contador del día en CERO

**Síntoma (Joan, vía Martín, 27/09/2026):** *«cada rato le dice a Joan que se quedó sin
tokens… es bastante raro, porque se queda muy rápido y eso que tiene varias cuentas
vinculadas»*.

Son DOS defectos que se tapaban entre sí, y el segundo es el que hacía imposible ver al
primero.

**1. El mensaje afirmaba dos cosas que nadie verificó.** La causa se elige con una regex
sobre el TEXTO del error (`lib/fallo-ia-texto.ts`) y **nunca le pregunta a la cuota**. Medido:
el 22 y el 24/09 ese texto salió diciendo «tus 2 cuentas llegaron al tope de hoy» en días en
que ese workspace tiene **cero** filas en `anthropic_usage`, contra un tope de 250/día. Y «se
reponen solas mañana» es falso para un 429 de Gemini, que también topea por MINUTO: mandar a
esperar a mañana por un límite que se destraba en un rato deja al cliente sin MaKo un día
entero por nada.

⚠️ **Y NO se arregla consultando nuestro contador** para concluir «entonces no es cuota». Las
keys son del CLIENTE (BYOK) y puede gastarlas fuera de la app; Google cuenta por proyecto, no
por workspace. Nuestro cero no prueba que le quede cuota — con la cuota realmente agotada
afuera, ese texto «más informado» diría «el proveedor está con problemas, reintenta» y sería
el mismo error con el signo cambiado. **Lo que se arregla es dejar de afirmar**: se dice que
rebotó por límite, que puede ser el del minuto o el del día, y qué hacer con cada uno.

**2. EL TERCER BUG DE LA ROTACIÓN: el doer de WhatsApp nunca probaba la segunda cuenta.** El
doer tenía su propio loop de PROVEEDORES y llamaba a `chatCheapTools` **sin `clave`**, así que
resolvía siempre la key base. Medido en `anthropic_usage`: `feature=mako-doer-in` tiene **24
llamadas con la cuenta 1 y CERO con la cuenta 2 en toda la historia** — mientras esa misma
key funcionaba perfecto por otro camino (`campaign-suggest`, 8 llamadas OK), porque ése sí
pasa por la cascada, que rota cuenta × proveedor.

O sea que el cliente leía «te quedaste sin cuota» teniendo **una cuenta entera sin tocar**, y
lo leía seguido, porque el peaje del 429 lo pagaba siempre la misma.

⚠️ **El arreglo no es reemplazar el loop por `chatCheapToolsCascade`**, aunque sea lo que
parece: ese loop tiene lo suyo (los centinelas, el molde volcado, el «no rotes si ya hay
borrador» de nunca-duplicar). Se despliega la lista de proveedores en sus CUENTAS y se itera
eso — desplegar en vez de anidar un segundo `for` es a propósito: el cuerpo tiene cinco
`continue` con semántica de «probá el siguiente», y anidando cada uno pasaría a significar
otra cosa.

⚠️ **Y el tercero se escondía detrás de los otros dos.** Los dos bugs ya cosechados de esta
zona —el tope por minuto cargado como diario, y la cuenta 1 compartiendo casillero con el
total— siguen arreglados (verificado contra HEAD). Arreglar dos de tres deja el síntoma
igual: si el cliente sigue reportando lo mismo después de un arreglo correcto, la pregunta no
es «¿falló el arreglo?» sino **«¿cuántas causas tenía esto?»**.

⚠️ **Y el fallo no se registra**, lo que hace circular el problema: `recordUsage` corre
DESPUÉS del throw, así que una llamada que revienta no deja fila. El uso medido no puede
contradecir al mensaje porque el uso medido sólo cuenta éxitos. Queda ABIERTO.

**Vive en:** `lib/fallo-ia-texto.ts` · `lib/mako-doer-in.ts` · `lib/ai-cheap.ts`
(`provsDe`, `rotulo`) · `tests/fallo-ia-texto.test.ts`

### ✅ El default del catálogo es lo que paga TODA feature que nadie configuró — US$37 en 30 días

**Síntoma (2026-08-08, segunda vez, con la misma pantalla):** «el Perro sigue utilizando a
Claude para tareas simples». La captura mostraba seis operaciones en **Claude · Sonnet 5**.

**El diagnóstico obvio era el equivocado, y por segunda vez el mismo día.** El Perro no
tenía nada que ver: sus últimas corridas pagas fueron a las **15:04**, todas con el
motivo `⚠ fallback: gemini falló (HTTP 429)` — el bug de un solo intento, ya arreglado
esa mañana. De ahí en adelante el Perro corre en Mistral a US$0. Lo que se veía en la
captura, a las 19:42, era **`plan-fathom`**: la extracción de tareas de una reunión.

`plan-fathom` **nunca tuvo override**. Y ahí está la trampa real: `/modelos-ia` escribe una
fila en `app_settings` **solo cuando alguien toca el botón**. Una feature que nadie tocó
cae en su `def` del catálogo, y el `def` de `plan-fathom` era `SONNET`. Corre sola en cada
reunión nueva, parte el transcript en cuatro pedazos de ~40k tokens y factura **~US$1 por
reunión sin decirlo en ningún lado**: 180 corridas y **US$37,42 en 30 días**, contra
US$0,81 del Perro en 48h. Con ella había otras cuatro en la misma situación
(`ads-analyst`, `landing-analyst`, `landing-writer`, `post-llamada`) y una sexta que
encontró el test recién escrito: `onboarding-extract`, en `gpt-4o-mini`, con el propio
audit recomendando Groq desde hacía meses.

Peor: **trece features tenían `def: SONNET` mientras un override las corría en Gemini.**
El default decía una cosa y la realidad era otra, así que leer el catálogo para saber qué
modelo usa una feature daba la respuesta equivocada — y cualquier workspace sin overrides
(un cliente nuevo) habría pagado los trece.

**Causa:** la regla «esto va en Gemini» vivía en un botón. Una regla que vive en un botón
no es una regla — el mismo diagnóstico que AGENTS.md ya tenía escrito para los prompts.

**La regla que queda, con las dos capas:** el `def` de una feature es un proveedor
**gratis**; si cobra, `pagoPorque` explica en una frase qué se compra, y
`tests/model-registry.test.ts` **falla si falta**. Quedan tres a propósito (`closing`,
`lead_insights`, `experimentos`: análisis pesado sobre datos reales, que es lo que el
cliente paga a sabiendas). Para que el test pudiera existir, el catálogo salió a
`lib/model-catalogo.ts` **sin `server-only`** — un módulo con `server-only` no lo puede
importar ningún test, y la guarda del gasto quedaba sin red justo donde más duele.

**Cómo verificarlo de nuevo** (el catálogo solo no alcanza: hay que cruzarlo con los
overrides): el modelo EFECTIVO de una feature es `override de ws1 ?? def del catálogo`.
Los overrides están en `app_settings` con `key='mako.modelos'`, y `modeloDeFeature` los
lee **siempre del workspace 1** (`runWithWorkspace(OWNER_WS, …)`), así que la copia del ws3
es vestigial y no la mira nadie. El gasto real, en `anthropic_usage` — y su columna
`motivo` distingue un cobro deliberado de un fallback, que es lo que permitió separar los
dos casos de este día.

**Vive en:** lib/model-catalogo.ts (el catálogo y la regla), lib/model-registry.ts (el override), tests/model-registry.test.ts, app_settings key `mako.modelos` · *2026-08-08*

### ✅ Un 429 de Gemini era suficiente para pagarle a Claude: el fallback saltaba cuatro proveedores gratis

**Síntoma (reportado con la pantalla de Operaciones de IA, 2026-08-08):** «el Perro
Guardián sigue cobrando dinero de Claude cuando ya había pedido que sea de Gemini para
ahorrar». Dos corridas seguidas — `Perro Guardián · priorización`, **Claude · Sonnet 5**,
US$0,162 y US$0,089, las dos con el motivo `⚠ fallback: gemini falló (chatCheap(gemini):
HTTP 429)`.

**El diagnóstico obvio era el equivocado.** No estaba mal configurado: `mako-guardian` está
ruteado a Gemini en `lib/model-registry.ts` desde hace meses, y `def` y `recomendado` son
los dos GEMINI. Lo que fallaba era el **fallback**, y fallaba de la peor forma posible: ante
un **HTTP 429** —o sea la cuota del minuto, el error más transitorio que existe y el más
previsible cuando el Perro corre en tandas— `chatClaude` hacía **un solo intento** y se iba
derecho a Sonnet. Sin reintentar Gemini, y sin probar los otros cuatro proveedores gratis
que estaban configurados y ociosos.

Lo irónico: la lógica correcta ya existía a un archivo de distancia. `chatCheapCascade`
reintenta el mismo proveedor ante 429/5xx, saltea a los que no les entra el prompt por su
techo de entrada y ordena por cuota disponible — pero el override de `chatClaude` llamaba a
`chatCheap` (singular). Ahora recorre la cascada entera, con el proveedor del registro
primero, y sólo paga si **ninguno** contestó (y ahí el motivo lo dice: «fallback pago:
fallaron los N proveedores gratis»).

De paso: el `esfuerzo` no viajaba dentro de la cascada, así que una feature con effort alto
que cambiara de proveedor corría en `minimal`. Mismo bug que [[effort-se-pierde-en-gemini]],
un nivel más abajo.

**Vive en:** lib/anthropic.ts (el bloque de override en `chatClaude`) · lib/ai-cheap.ts (`chatCheapCascade`, ahora con `esfuerzo`) · *2026-08-08*

### ⚠️ El override de modelo del dueño gobierna a TODOS los workspaces, y el del cliente no se lee nunca

**Síntoma:** `plan-fathom` figuraba como Sonnet en el catálogo y las 25 llamadas del ws 9
habían corrido en `gemini-flash-latest`. Además existía una fila de override en el ws 3 que
NUNCA se lee.

**Causa:** `leerOverrides()` hace `runWithWorkspace(OWNER_WS, () => getSetting('mako.modelos'))`:
siempre lee el override del workspace dueño, sin importar quién esté corriendo. Lo mismo
hace `setModeloFeature`. O sea que `mako.modelos` es un ajuste **global de plataforma**
aunque la tab se vea dentro de un workspace.

**Regla:** el modelo efectivo de una feature no se deduce del catálogo ni del workspace que
corre — hay que mirar `mako.modelos` del OWNER_WS. Y si algún día se quiere modelo por
cliente, esa línea es el bloqueo.

**Vive en:** lib/model-registry.ts:86-115 (`leerOverrides` :98, `setModeloFeature`) ·
setting `app_settings['mako.modelos']` · *2026-08-05 ~borrador-reunion-fathom-frentes +
2026-07-22 audit-ia-routing*

### ⚠️ El tag de `feature` es la unidad del override, y hay dos procesos compartiendo uno

`lib/retro-gate.ts:126` (`debatirGate`, el gate de fase de la Retro) llama con
`feature: 'mako-guardian'` en vez de una feature propia: cambiar el modelo del Perro
Guardián desde /modelos-ia mueve también, sin que nadie lo pida, el debate del gate de fase.
El error clásico documentado es el inverso —un tag que no existe en el catálogo y hace que
el override no aplique nunca—; este es el que sí aplica, **al proceso equivocado**.

**Vive en:** lib/retro-gate.ts:126 · *2026-07-22 audit-ia-routing*

### ⚠️ El nombre de la función no dice qué modelo corre: `chatClaude` sobre features que están en Gemini

**Síntoma:** leyendo el call-site se concluye «esto paga Claude». `plantillaDesdePaso`
(lib/nutricion-plantillas.ts:198, `feature: 'nutri-plantilla'`) y `destilarVoz`
(lib/nutricion-generator.ts:117-118, `feature: 'nutri-destilar-voz'`) llaman a `chatClaude`.
Así las marcó el catálogo de la API de MaKo en la corrida del 16/09: costo `dinero`, sobre
operaciones que no cobran (quedaron en `costo: 'ia'`, lib/api-mako/areas/chatbot.def.ts:442,450).

**Causa:** `chatClaude` es la puerta, no el modelo. Las dos features tienen `def: GEMINI()`
(lib/model-catalogo.ts:189 y :196); con un ref que no es anthropic, `chatClaude` recorre la
cascada barata, y si toda la cascada falla el fallback a Sonnet lo corta el veto: ninguna de
las dos está en `CLAUDE_PERMITIDO` (lib/veto-claude.ts). No cobran nunca.

**Regla:** el costo de una operación se decide mirando `lib/model-catalogo.ts` + el override
del ws1 + el veto, nunca el nombre de la función que llama al modelo.

**Vive en:** lib/model-catalogo.ts:189, :196 · lib/nutricion-plantillas.ts:198 ·
lib/nutricion-generator.ts:117-118 · *2026-09-16 api-mako-areas*

### ⚠️ El override de /modelos-ia no re-rutea nada para las features que corren por la cascada barata

`modeloDeFeature()` lo consulta `lib/anthropic.ts` (chatClaude) y nadie más:
`chatCheapCascade` NO lo lee. Una entrada nueva en `CATALOGO_MODELOS` para una feature que
corre por la cascada es **decorativa**: se pinta en la pantalla y no cambia a dónde va la
llamada.

Matiz que agregó la verificación: `chatClaude(..., {feature})` **sí** re-rutea un ref
no-anthropic a `chatCheap` con fallback a Sonnet (así corren hoy mako-guardian y
checklist-coach en Gemini). O sea que hay dos caminos y solo uno respeta el registry. El
precedente para pinear el modelo en la cascada es `overrideDeFeature` en
lib/mako-doer-in.ts:529.

**Vive en:** lib/model-registry.ts:99 · lib/ai-cheap.ts:207 · *2026-08-05 cierre-ronda-mako*

### ⚠️ El pin de proveedor descarta también el `effort` que eligió el router

Con el pin de `mako-doer-in` a `gemini-flash-latest`, el pin no-anthropic descarta el modelo
**y** el effort elegido por el router. Flash cumple el CUÁNTO y no el CÓMO: el detalle subió
a 649 chars de mediana y el formato de 4 partes salió en **0 de 5** tareas (escribió
«Cita: …» en prosa). Ver también «A un modelo rápido no lo atás con más prompt», en [El doer](#el-doer).

**Vive en:** lib/mako-doer-in.ts (el pin no-anthropic) · *2026-08-06 contexto-de-todas-las-tareas*

### ⚠️ Pendiente: «menos Opus de más» no se ve en la tab Modelos de IA

El dueño lo marcó y sigue sin reflejarse: hay muchos procesos usando Opus donde no hace
falta. *(2026-07-15)* Su criterio: «Siento que estás utilizando MUCHÍSIMO a Opus 4.8, en
tareas que no es eficiente utilizarlo».

**Vive en:** lib/model-registry.ts (`CATALOGO_MODELOS`) · app/modelos-ia

### Regla: la cascada por costo es Gemini → Groq → OpenAI, y Claude no es default de nada

«Si hazlo, pero primero Gemini, luego Groq y por ultimo openai» (2026-07-29). «NO que jamás
caiga a Claude… Quiero EVITAR caer en el gasto con Claude» (2026-07-22). Claude queda
reservada para razonamiento complejo, y hay que **buscar activamente más IA gratuitas para
rotar**. Antes de meter Claude en un proceso, la pregunta es si no alcanza un modelo
barato o gratis: «me está consumiendo muchísimos tokens y dinero el MaKo en Whatsapp… no
podemos utilizar Groq que es gratuito? Se honesto» (2026-07-19). Y el modelo se elige por
tarea real: una petición simple no justifica el modelo caro.

### Decisión: cada cliente trae su propia Gemini y los procesos de Claude se migran a barato

Para eso se construyó todo el sistema de integraciones (BYOK). El costo de tokens de MaKo
en WhatsApp era insostenible: «por más de que entrene, no se paga nada y da 1M de tokens»;
«eso a escala con muchos clientes, son cientos o miles» de dólares. *(2026-07-22)*

### Decisión: tab de SuperAdmin para ver y editar qué modelo usa cada tarea

Más una sección de Saldo IA con las 3 IAs cargables a mano. Necesita controlar el gasto y
saber con qué corre cada cosa. *(2026-07-15)*

### Decisión (en tensión con el código): si falla la IA elegida, error explícito y no cascada

«Un fallback silencioso oculta que el proveedor configurado no está funcionando y ensucia el
costeo» *(2026-07-22)*. Ojo: hoy `chatCheapCascade` hace exactamente lo contrario, y encima
lo hace mal (ver [La capa barata](#la-capa-barata)). Cuando se toque la cascada, esta
decisión es la que manda: el usuario tiene que enterarse de que su proveedor no respondió.

---

## La capa barata

### ⚠️ La rotación tenía DOS ejes y el que faltaba era el modelo: Google tenía caído el que fijamos

**Síntoma (16/08, con un cliente esperando):** el cliente sube 4 documentos al Archivero y
«No se pudo procesar nada de lo que subiste». Tres avisos genéricos («probá de nuevo en un
momento») y uno que decía **«Se quedó sin cuota / límite de uso alcanzado»**. La API key era
**nueva**, recién creada.

**Diagnóstico obvio: la cuota. Equivocado, DOS veces.** Medido con la key real del cliente y
el mismo payload de 24k caracteres:

| modelo | resultado |
|---|---|
| `gemini-flash-latest` ← **el que fija `MODELO_DOCS`** | **503 «high demand»**, persistente |
| `gemini-2.5-flash` | 404 «no longer available to new users» |
| `gemini-flash-lite-latest` | **200, perfecto** |

O sea: Google tenía caído el alias que la app fija, y **al lado, en la misma cuenta, había un
modelo sano**. La cascada tenía dos ejes de rotación —cuenta y proveedor— y ninguno sirve
para esto: probaba las N cuentas contra el mismo modelo muerto y se rendía con el resto del
catálogo del proveedor intacto. Con **un solo proveedor cargado**, que es el estado normal de
un cliente recién dado de alta, eso es quedarse sin IA teniendo IA.

**La trampa de medición que casi me lo tapa:** probé la key con un `"di ok"` y dio 200 tres
veces. Un request chico pasa; uno de 9.400 tokens no. **Medí la key cuando el que fallaba era
el modelo.** Si vas a descartar «es la key», el request de prueba tiene que tener el TAMAÑO
del real.

**Y el mensaje mandaba a arreglar lo que no estaba roto.** `motivoDeErroresCascada` no tenía
caso para 503: los tres primeros documentos caían al genérico y el cuarto matcheaba `\b429\b`
por un rate-limit suelto de la misma tanda → «sin cuota». La diferencia es accionable y
opuesta: **la cuota se arregla cargando otra key o pagando; la saturación se arregla
esperando.** Mandar a alguien a comprar créditos por un bache del proveedor es el peor consejo
posible. Ahora la saturación se clasifica y va ANTES que la cuota, porque en una tanda de
varios documentos aparecen las dos mezcladas y manda la que explica la tanda.

**Reglas que quedan:**
- **Tercer eje: el modelo.** `MODELOS_RESPALDO` en `lib/ai-cheap.ts`. Un 404 no se reintenta
  ni un segundo (un modelo retirado no vuelve): se salta derecho al siguiente.
- **En esa lista NO van ids con número de versión.** Google los retira solos —`2.5-flash` y
  `2.0-flash` ya dan 404— así que solo alias `-latest`.
- **Cuánto insistir depende de si hay a dónde caer.** Con otra cuenta o proveedor esperando,
  un reintento; cuando es el ÚLTIMO recurso, 3 con espera creciente (1,5s · 4s · 9s).
- **Un modelo más flojo de respaldo es correcto**: solo entra cuando el bueno no está, y la
  alternativa no es «una respuesta peor» sino NINGUNA.

**Vive en:** lib/ai-cheap.ts (`MODELOS_RESPALDO`, `modelosAProbar`, la cascada de chat y
`leerDocumentoIA`) · lib/ia-mensajes.ts (`motivoDeErroresCascada`) · tests/ia-mensajes.test.ts
*— corrida del 16/08/2026*

### ⚠️ Ese respaldo también degrada a las features que el catálogo jura que no se degradan

**Síntoma (17/9, probando el juez del criterio de Mauricio):** el mismo juez, con el mismo
criterio y la misma reunión, cambiaba de opinión entre corridas: la sesión del anexo dio 6
compromisos en una y 2 en la siguiente. **Parecía** un problema del prompt. **No era solo
eso:** `anthropic_usage` dice que **18 de las 19 llamadas corrieron en `gemini-flash-lite`**,
no en `gemini-flash`. Google estaba dando 503 y la cascada bajó de modelo sin avisar.

**La causa:** `fallback: []` en el catálogo (lib/model-catalogo.ts) frena el eje PROVEEDOR, no
el eje MODELO. El respaldo a flash-lite de arriba se agregó el 16/08 para leer documentos, pero
corre en TODA la cascada de chat. Desde entonces le pasa a las dos features cuyo catálogo dice
«NO se degrada de modelo: si Gemini no contesta, la lectura falla y se reintenta sola». Medido
en prod, últimos 30 días:

| feature | en flash-lite |
|---|---|
| `plan-fathom` (extraer tareas de una reunión, todos los clientes) | **146 de 553 (26%)** |
| `mako-guardian` (el Perro) | **57 de 148 (39%)**, y 3 más en `openai/gpt-oss-20b` |

El test `las features cuyo error ESCONDE trabajo no se pueden degradar de modelo`
(tests/model-registry.test.ts) pasa, porque solo mira `fallback`. **Dos intenciones escritas
chocan:** «antes que degradar, se paga» (el catálogo) contra «un respaldo más flojo es correcto,
la alternativa es NINGUNA respuesta» (esta sección). Para leer un documento, la segunda tiene
razón. Para un JUICIO que nadie revisa después (qué tarea existe, qué va primero), gana la
primera. **Quedó sin decidir** cuál gana en cada feature. Mientras tanto, cualquier número de
calidad medido sobre `plan-fathom` o `mako-guardian` mezcla dos modelos, y hay que filtrarlo
por `anthropic_usage.model` antes de creerlo.

**Vive en:** lib/ai-cheap.ts (`MODELOS_RESPALDO`, `modelosAProbar`) · lib/model-catalogo.ts
(`fallback`) · tests/model-registry.test.ts *— 2026-09-17*

### ⚠️ El free tier del modelo son VEINTE requests, y un onboarding se los come solo

El error completo, cuando por fin se leyó entero, traía el número:

> `Quota exceeded for metric: …/generate_content_free_tier_requests, **limit: 20**, model:
> gemini-3.7-flash. Please retry in 47.4s.`

`gemini-flash-latest` resuelve a `gemini-3.7-flash`, y su free tier son **20 requests**. Un
onboarding con 6 documentos y varias fotos de la cara de marca se lo come sin despeinarse.
**No es un cliente que use de más: es el modelo equivocado para el trabajo.**

Corolario que sirve para elegir respaldo: **cada modelo tiene su propio balde de cuota**. Así
que rotar el modelo no solo esquiva un 503 — también esquiva el límite de 20.

**Vive en:** lib/ai-cheap.ts (`MODELO_DOCS`, `VISION_CASCADE`) *— 16/08/2026*

### ⚠️ La función que decide qué lee el usuario vivía encerrada en un módulo `server-only`

`motivoDeErroresCascada` es **pura** y estaba adentro de `lib/ai-cheap.ts`, que lleva
`server-only`: **ningún test la podía importar**. O sea que lo único sin red era justamente lo
que le habla a la persona — y por eso un 503 pudo reportarse como «sin cuota» durante quién
sabe cuánto.

Peor: el test que sí existía tenía el bug **congelado** como caso esperado
(`{ motivo: null, errores: ['HTTP 503 high demand'] }`).

Se mudó a `lib/ia-mensajes.ts`, que existe exactamente para eso y no tiene `server-only`. Es
la misma regla que ya sacó a `exigirClienteDePrueba` y a `model-catalogo` de sus módulos
server-only: **si una condición no se puede importar desde un test, es la que va a envejecer
mal.**

**Vive en:** lib/ia-mensajes.ts · tests/ia-mensajes.test.ts *— 16/08/2026*

### ⚠️ La salida para «conectá otra IA» existía… en UNA sola pantalla

`ConectarIA` —que muestra las cinco IA gratis con su estado real y deja sumar otra cuenta—
estaba enchufado en `MatrizView` y en ningún otro lado. En el paso de la cara de marca y en el
Archivero, el cliente veía el error crudo de Google y **cero botones**, justo cuando todavía
tiene una sola key y menos idea tiene de que puede cargar otra.

**Y aunque el componente hubiera estado puesto, no se habría dibujado:** el detector era un
regex suelto en `MatrizView` que buscaba **«cuota»**, y lo que Google manda es **«quota»**.
Dos fallas encadenadas que se tapaban entre sí — arreglar una sola no habría cambiado nada.

Quedó: `esErrorDeIA` en `lib/ia-mensajes.ts` (puro, con test, cubriendo el crudo en inglés) y
una pieza `ErrorIA` que dibuja error **y** salida juntos, con guarda que falla si una pantalla
deja de usarla. El error crudo del proveedor va detrás de «ver detalle»: al cliente le
llegaron seis renglones con `generativelanguage.googleapis.com/...` y dos URLs de
documentación de Google, que no le dicen qué hacer y **entierran el botón que sí lo resuelve**.

⚠️ Lo que NO se tocó, a propósito: `app/api/email/unsubscribe/route.ts:40` también dice
«escribinos» sin dirección, pero esa página la ve el **lead de un cliente**: poner ahí la
dirección de MaKo mandaría los leads de otro negocio a nuestra casilla.

**Vive en:** app/_components/ErrorIA.tsx · lib/ia-mensajes.ts (`esErrorDeIA`) *— 16/08/2026*

### ⚠️ La cascada no cae a otro lado: pedir un proveedor sin key devuelve Groq, y el log miente

**Síntoma:** el "fallback" no rescata nada y el registro de uso dice que probó Mistral.

**Causa:** `chatCheapCascade` recorre `provs` y llama a `chatCheap({ provider: prov })`;
`proveedor(pref)` hace `if (pref) { const p = await provDe(pref); if (p) return p; } return
provDe('groq') ?? provDe('openai')` — si el proveedor pedido no tiene key, **no falla ni se
saltea: corre en Groq**. Con `CASCADA_GRATIS = ['groq','cerebras','openrouter','mistral','openai']`
y solo GROQ/OPENAI/GEMINI cargadas, la cascada real es groq, groq, groq, groq, openai:
cuatro intentos contra el mismo modelo, con el mismo prompt y (salvo que el caller pase
`temperature`) la misma salida. Peor para el diagnóstico: el `motivo` que queda en el
registro de uso es `«… · fallback mistral»` aunque nunca se haya llamado a Mistral, y si el
caller pasó `modelos: { mistral: 'x' }`, ese nombre de modelo se le manda a Groq.

**La amplificación que nadie ve:** como `proveedor()` no corta rápido cuando falta la key,
si Groq está lento-colgado los slots de cerebras/openrouter/mistral vuelven a pegarle al
MISMO Groq y queman 30s cada uno — una sola cascada puede llegar a **150s**.

**Regla:** antes de suponer que un fallback probó otro proveedor, chequeá que la key exista;
y la cascada debería saltear los proveedores sin key en vez de colapsarlos en el default.

**Vive en:** lib/ai-cheap.ts:67-73 (`proveedor`), :84, :141-144 (`chatCheap`), :159-172,
:237-257 (`chatCheapCascade`) · *2026-08-02 ~chat-agent-ensayo-y-secuencias + 2026-07-29
review-onboarding-resto*

### ⚠️ Un `validar` que acepta el vacío corta la fila de proveedores gratis

**Síntoma:** «MaKo no armó preguntas» / «MaKo no devolvió avatares», aunque el proveedor
siguiente de la cascada hubiera funcionado.

**Causa:** el guard de `chatCheapCascade` es `if (t.trim() && (!opts.validar || opts.validar(t))) return t;`
y los validadores estaban escritos sobre la FORMA, no sobre el CONTENIDO:
`(t) => Array.isArray(parseJsonLoose(t).preguntas)` da true para `{"preguntas":[]}`, y
`tieneAvatares` daba true para `{"avatares":[]}` y para items sin `nombre`. El primer
proveedor devuelve un array vacío, la cascada lo da por bueno, **no prueba a nadie más**, y
el consumidor filtra y se queda sin nada — exactamente lo que `validar` existe para
rescatar.

**Regla:** el `validar` de una cascada tiene que usar el MISMO parser que consume el
resultado (`parseAvatares(t).length > 0`) y exigir el mínimo utilizable (`arr.length > 0` y
los campos que el consumidor va a leer). Un JSON que parsea pero es inútil debe caer al
próximo proveedor.

**Vive en:** lib/onboarding.ts:233 (`generarPreguntasCerradas` de El Archivero, **sigue
vivo**) · lib/avatares.ts:150 (`tieneAvatares`, ya corregido: es el patrón a copiar) ·
lib/ai-cheap.ts (`chatCheapCascade`) · *2026-07-28 ~review-tanda-avatares +
~review-avatares-angulos-onboarding*

### ⚠️ La cascada disfraza de «el proveedor falló» dos problemas que son nuestros

Cuando una llamada termina en «tu IA está conectada pero no pudo responder ahora mismo
(puede ser un límite de uso)», casi nunca es el proveedor.

1. **Timeout fijo.** `chatCheap` usa `AbortSignal.timeout(opts.timeoutMs ?? 30000)`,
   mientras que `chatClaude` sí escala el timeout con el pedido
   (`min(120000, max(30000, maxTokens*12))`). Una respuesta grande aborta a los 30s y la
   cascada lo anota como fallo del proveedor y prueba el siguiente.
2. **Truncación disfrazada de red.** Si la respuesta se corta por `maxTokens`,
   `parseJsonObject` hace `JSON.parse` estricto y **lanza adentro de `validar`**, que corre
   dentro del try del bucle: el throw del parser es indistinguible de un error de red y
   hasta dispara el reintento. La única señal real de truncación es un `console.warn` con
   `finish_reason`.

**Regla:** propagar `finish_reason='length'` hasta el envelope con un error que diga «se
cortó, bajá la cantidad», y usar un parser tolerante (ya existe: `parseJsonLoose` en
lib/secuencias-variantes.ts).

**Vive en:** lib/ai-cheap.ts:175, :187-188, :207-235 · lib/anthropic.ts:48 ·
lib/campaign-structurer.ts:205-210 · *2026-08-06 ~fabrica-creativos-y-ads-writer-research*

### ⚠️ El `maxDuration` de un route tiene que cubrir la cascada ENTERA, no una sola pierna

**Síntoma:** el usuario tocaba «Que MaKo la describa» y recibía un 504 pelado en vez del
mensaje amable que el código tenía escrito para ese caso.

**Causa:** `generarDescripcionPersona` llamaba a `leerDocumentoIA` sin pasar `timeoutMs`, y
cada pierna de `VISION_CASCADE` se auto-asigna 100s por defecto; las piernas corren
SECUENCIALMENTE, así que con Gemini colgado y OpenAI de respaldo el peor caso rondaba los
200s contra un `maxDuration` de 120 — Vercel mataba la función antes de que el
`{ ok: false, error }` llegara al cliente. El camino feliz nunca lo mostraba, y por eso no
se veía. El mismo patrón muerde en el onboarding: la acción 'guion' encadena DOS cascadas en
serie (`elegirAngulo` + `generarGuion`) contra un `maxDuration=120` → 504, y el guion
generado **se pierde** porque solo se persiste al final.

**Regla:** si un route llama a una cascada, su presupuesto tiene que ser mayor que
N × `timeoutMs`, y el timeout se pasa EXPLÍCITO desde el caller (como ya hacen
extract-deal-fiscal y extract-contract). Un timeout por-proveedor sin presupuesto total no
acota nada: degrada un error controlado en una caída dura.

**Vive en:** lib/ai-cheap.ts (`leerDocumentoIA` / `VISION_CASCADE`, default de 100s por
proveedor) · app/api/onboarding/persona/route.ts + lib/persona.ts (caso testigo) ·
app/api/onboarding/razones/route.ts:51-55 · *2026-07-29 ~audit-onboarding-persona +
review-onboarding-resto*

**Y `chatCheapCascade` tiene la misma forma, con más multiplicadores** *(2026-09-16
api-mako-areas)*. El `timeoutMs` llega entero a CADA intento: por proveedor, por cuenta y por
modelo de respaldo (lib/ai-cheap.ts:437-455). `CASCADA_DOCS` son cinco proveedores
(lib/ai-cheap.ts:217), así que 25 s para escribir un guion pueden ser 125 s o más. Dos cosas
que no se ven desde el caller:

- **Sumar los timeouts de una cadena no da un techo.** Sugerir + formato + guion en serie no es
  «48 s»: cualquier escalón se puede pasar. Lo único que acota es un deadline absoluto que el
  caller mira antes de arrancar cada paso — y un paso ya arrancado igual se pasa.
- **Una función que ESCRIBE al final no se corta con `Promise.race`.** Cortar la espera de
  `generarGuion` o `elegirAngulo` no corta la función: sigue, guarda el guion, y el caller ya lo
  reportó como fallido. Correr contra un reloj solo es seguro sobre algo que no escribe.

~~**Sin hacer:** `recomendarFormatos()` no acepta `timeoutMs`~~ — **ya no aplica (23/10/2026)**: la función y su
operación se sacaron (docs/hallazgos-onboarding.md → «Ángulos»). La regla de arriba (una carrera sólo sobre lo que no
escribe) sigue.

### La letra chica de los free tiers, que no avisa cuando muerde

Research de julio 2026 sobre los proveedores de `lib/ai-cheap.ts`. Cuatro cosas que no están
en ninguna doc del repo:

1. El free tier de **Gemini ENTRENA con tus datos** y tiene revisión humana, y la excepción
   EEA/CH/UK no aplica a MX ni AR — mandar PII de un CRM por ahí es un problema. El «billing
   trap»: al prender billing en el proyecto, el free tier desaparece.
2. Los límites de Gemini son **por proyecto, no por API key**: repartir más keys NO
   multiplica la cuota. Importa para BYOK.
3. **Cerebras** en free capa el contexto a **8.192 tokens FLAT**: un prompt largo no se
   degrada, falla.
4. Los modelos `:free` de **OpenRouter** exigen activar el toggle de logging/entrenamiento;
   sin eso responden «No endpoints found matching your data policy».

Groq y Cloudflare son los limpios en privacidad (no entrenan), pero el pool de **10.000
neurons/día de Cloudflare es COMPARTIDO** entre LLM y STT: transcribir mucho audio se come el
presupuesto de las clasificaciones.

**Vive en:** lib/ai-cheap.ts (`chatCheapCascade`, `transcribirAudio` y las constantes de
cascada) · *2026-07-14 research-free-ai-apis*

### ⚠️ Pendiente: dos STT hardcodeados a `whisper-1` no pasan por el choke point

`lib/ai-cheap.ts` ya elige proveedor por env (Groq `whisper-large-v3-turbo` si hay
`GROQ_API_KEY`, si no OpenAI), así que casi todo el STT se abarata sin tocar código. Pero
`transcribeMediaBuffer` (clases del portal de conocimiento) y `transcribeAd` (video de cada
anuncio de Meta) arman su propio form con `model: 'whisper-1'` y no llaman a
`transcribirAudio`: quedan clavados en OpenAI. Justo el de ads es el de más volumen, porque
corre en cron y en backfill sobre cientos de anuncios. Al migrarlos hay que conservar el tope
de 25 MB y `response_format: verbose_json` (se usa `duration` para calcular el costo).

**Vive en:** lib/transcribe.ts:171 y :257 · *2026-07-15 ~ruteo-ia-por-tarea*

### Decisión: NVIDIA build.nvidia.com queda descartado como proveedor

Se evaluó como capa gratis para ai-cheap. Los LLM son OpenAI-compatibles (baseURL
`integrate.api.nvidia.com/v1` + key `nvapi-`) y entrarían casi drop-in, pero hay dos frenos
duros: los Trial ToS dicen que NVIDIA puede usar tus inputs y outputs para entrenar y
**prohíben explícitamente subir PII** —que es exactamente lo que procesa la app: leads y
notas de voz de clientes—, y es un trial declarado «not intended for production», con 40 RPM
(~2.400 requests/día) y sin SLA. Además el STT NO es drop-in: los ASR hosteados (parakeet,
canary, whisper) corren por gRPC/Riva, no por `/audio/transcriptions`, así que habría que
reescribir `transcribirAudio` o meter un puente. La única vía privada, self-hostear NIM,
exige GPU y deja de ser gratis. **Decisión:** Groq sigue siendo el default para todo lo
productivo; NVIDIA, a lo sumo, como laboratorio para benchmarkear con datos que NO sean de
clientes.

**Vive en:** lib/ai-cheap.ts (resolución de proveedor por env) · *2026-07-14 research-nvidia-nim*

### Decisión: transcribir cursos largos va con audio, tier pago y trozos de 10 minutos

Research para bajar cientos de horas de cursos de Drive; **no está implementado** (hoy
/conocimiento transcribe con Whisper de OpenAI, tope 25 MB). Lo que decide el diseño si
alguna vez se construye:

1. Mandar el **AUDIO** extraído, nunca el video: 32 tokens/segundo contra ~300, casi 10x, y
   el video además topea en ~1h de contexto mientras el audio llega a 9,5h. Gemini
   downsamplea a 16 kbps mono igual, así que codificar mono/16k no pierde nada (~7 MB/hora).
2. El modelo **RESUME o limpia el habla si no se le prohíbe explícitamente**: hay que pedir
   verbatim, con muletillas y sin corregir gramática.
3. Los timestamps en audios largos **no son de fiar** (bug del foro oficial, 2026: deriva de
   hasta -157s en Flash) y arriba de ~15 min aparecen repeticiones y alucinaciones. Trozos de
   10 min con 30s de solape bajan la deriva a 5-10s y evitan el costo casi-cuadrático.
4. La Files API NO acepta URLs remotas y un link de Drive redirige al intersticial de
   virus-scan: hay que bajar los bytes, y para cientos de archivos conviene la Drive API v3
   `files.get?alt=media` con service account en vez de scrapear el `confirm`.
5. Tier **PAGO**, no free (el free entrena con tu contenido). Con Flash-Lite el costo es
   ~US$0,04/hora.

**Vive en:** lib/ai-cheap.ts (`transcribirAudio`, `MAX_INLINE_GEMINI=14MB`) ·
app/api/mako/knowledge/transcribe/route.ts (lo que hay hoy) · *2026-07-21
~research-transcribir-cursos-con-gemini*

---

### ⚠️ «MaKo» entra al sistema escrito «Maco», por la puerta del audio

El dueño manda una nota de voz por WhatsApp, Whisper transcribe **«Maco»** —que es como
suena—, esa cadena se convierte en el TÍTULO de una tarea («Configurar plantillas de funnels
por tipo (TOFU) en Maco») y desde ahí el Perro la repite en su razón de puntaje y en la
justificación del deadline. **Una marca mal escrita se propaga sola porque cada eslabón copia
el texto del anterior**, y para cuando se ve en pantalla ya está en cinco lugares.

Por eso hacen falta las dos capas: `REGLA_MARCA` en `MAKO_NUCLEO` (para lo que la IA escribe
de cero) y `corregirMarca()` determinista en la **entrada** — la transcripción y el saneo del
título/detalle de la tarea. El prompt no llega a lo que entra transcripto.

⚠️ La lista de variantes es CERRADA (`maco|mako|macko|makko`, palabra completa) y **«Marco» no
está**: es un nombre de persona, y convertir el nombre de alguien en el de la marca es peor
que dejar un «Maco» suelto.

**Vive en:** lib/mako-gramatica.ts (`corregirMarca`, `REGLA_MARCA`) · lib/ai-cheap.ts (`transcribirAudio`) · lib/plan-propuesta.ts (`limpiarTarea`) · *2026-08-08*

---

### La rotación tenía UN eje y hacen falta DOS: proveedor y CUENTA

**Síntoma:** «se quedó sin cuota» con la key de Gemini puesta, y la única salida que ofrecía
la pantalla era pegar de nuevo la key de Gemini — la misma que estaba agotada.

**Causa:** el free tier se agota **por cuenta**, no por proveedor, y la app solo sabía guardar
UNA key por proveedor: `credenciales` es una fila por `(workspace, clave)` y la clave era
`GEMINI_API_KEY` a secas. O sea que la respuesta natural del usuario —«tengo otra cuenta de
Google»— no tenía dónde entrar. La cascada rotaba entre proveedores y eso tapaba a medias el
problema: ante un 429 de Gemini contestaba un Llama de 70b, cuando lo correcto era la segunda
cuenta de Gemini (mismo modelo, mismo millón de contexto).

**Cómo quedó:** claves derivadas `GEMINI_API_KEY_2` / `_3` (`lib/ia-keys.ts`, sin `server-only`
para que se pueda testear), hasta 3 por proveedor gratis. Sin migración y sin tabla nueva: para
`credenciales` son filas más, con el mismo cifrado y la misma auditoría. `provsDe(prov)` devuelve
una instancia por cuenta cargada y **todos** los caminos iteran sobre eso: chat, tools, STT y
visión.

**Dos cosas que NO son obvias:**

- **El gauge mide el conjunto, no el reparto.** `anthropic_usage.provider` guarda `gemini`, no
  cuál de las tres keys, así que el % de cuota es del proveedor entero y el tope se multiplica
  por la cantidad de cuentas. Sirve para lo que decide (a quién probar PRIMERO); el salto real
  entre cuentas lo hace la cascada **por error** (429 → próxima cuenta), que no depende de ese
  número.
- **Un 429 no se reintenta si hay otra cuenta esperando.** Esperar 1,5 s para volver a pegarle a
  la cuota que se acabó es tiempo tirado; el reintento del mismo proveedor queda solo para la
  última cuenta, que es donde no hay a quién caer.

**Y de paso se cerró el colapso a Groq** que documenta el hallazgo de arriba: la cascada ahora
pide `provsDe(prov)` y **saltea** al proveedor sin key, en vez de dejar que `proveedor(pref)`
lo colapse en el default y le pegue cuatro veces al mismo Groq.

**Vive en:** lib/ia-keys.ts · lib/ai-cheap.ts (`provsDe`, `chatCheapCascade`, `transcribirAudio`,
`leerDocumentoIA`) · lib/ia-cuotas.ts (`cuentasDe`, `limitesEfectivos`) · *2026-08-12
rotación multi-cuenta*

### Sumar tres cuotas que no se pueden trasvasar: el panel decía «te sobra» y no había

**Síntoma:** una clienta con TRES cuentas de Gemini conectadas ve «No hay IA para generar
las razones. Conecta tu API key de Gemini (gratis) en Integraciones.», y el panel de al lado
le dice **240,6k / 750,0k** — o sea que le sobra el 68% de la cuota del día.

**Medido contra sus datos** (12/8/2026, ws 11):

```
gemini (3 cuentas): total 241k tok · 32% del conjunto
    cuenta 1: 24 pedidos · 241k tok → 96%  ⛔ SIN CUOTA
    cuenta 2:  0 pedidos ·   0k tok →  0%
    cuenta 3:  0 pedidos ·   0k tok →  0%
```

**Causa:** las dos cifras eran ciertas y la conclusión falsa. El free tier se agota **por
cuenta**: tres keys no son un tanque de 750k, son **tres tanques de 250k que no se
trasvasan**. Todo el uso estaba apilado en la cuenta 1 —porque la cascada empieza siempre
por la primera y solo salta cuando la anterior FALLA— así que esa cuenta estaba al 96% y
el panel promediaba con dos cuentas intactas que no la podían ayudar hasta que llegara el
429.

**La regla: un total solo se puede sumar si el recurso se puede mover de lugar.** Cuota
diaria de cuentas distintas, no. El total sigue estando (responde «cuánto consumí hoy»),
pero el `agotado` ya no sale de él —un proveedor está sin cuota cuando lo están TODAS sus
cuentas— y el panel muestra el reparto, una fila por cuenta.

**Y la mitad que faltaba era proactiva.** Rotar solo por ERROR significa que cada llamada
le paga un 429 de peaje a la cuenta muerta antes de llegar a la que tiene nafta; con tres
cuentas, tres peajes. Ahora `provsDe` ordena las cuentas por cuota disponible (`ordenarCuentas`),
así que con la cuenta 1 al 96% la próxima llamada arranca en la 2.

**Lo que esto NO explica, y conviene no confundir:** que la generación fallara. Las tres
keys son distintas y contestan (probadas una por una: 200, 503 transitorio de Google, 200).
El diagnóstico obvio —«las 3 keys son del mismo proyecto de Google y comparten cuota»— era
el equivocado, y se descartó pingueando cada una por separado. Lo que hacía indiagnosticable
el caso era el mensaje, no la rotación.

**⚠️ Y el reparto numera las cuentas por CANTIDAD, mientras el uso se registra por SLOT
(16/09/2026).** `cuotasProveedores` (lib/ia-cuotas.ts:175-176) arma las filas con
`n = Math.max(1, cuentasDe(provider))` y `Array.from({ length: n })`: cuántas keys hay
cargadas, con piso 1. Pero `ai-cheap` registra `cuenta = clavesProv(nombre).indexOf(clave) + 1`
(`nroCuenta`, lib/ai-cheap.ts:149), o sea el slot del catálogo: `GEMINI_API_KEY_3` es la
cuenta 3 aunque sea la segunda cargada. Con keys en los slots 1 y 3, el panel pinta «cuenta 2:
0%», el uso real de la 3 no aparece, y como `agotado` exige que lo estén TODAS, la fila 2
fantasma (siempre libre) hace que el proveedor no se vea agotado nunca. Y un proveedor SIN
ninguna key sale con «cuenta 1: 0%», que se lee como disponible. `ordenarCuentas` (:226-243)
sí cruza por slot; el panel no.

La otra punta tiene el error espejo: `ordenarPorCuota` (:202-218) recorre `clavesDe(p).length`
slots —los 10 de `MAX_KEYS`, cargados o no— y un slot sin uso cuenta como libre. Un proveedor
multi-key (gemini, groq, mistral, openrouter) no queda «agotado» nunca y nunca baja al final
de la cascada.

**Regla:** las cuentas se iteran sobre las claves CARGADAS con su slot (`slotDe`,
lib/ia-keys.ts:97), nunca `1..n` ni `1..MAX_KEYS`; con cero cuentas, `agotado: null` y el
reparto vacío, no una cuenta inventada. `ver_cuotas_ia` de la API tapa solo el caso de cero
cuentas (lib/api-mako/areas/integraciones.run.ts:167,169) y su `por_cuenta` sale de la misma
numeración. **HECHO el 19/09/2026** (ver la entrada de abajo): las tres funciones iteran los SLOTS
cargados (`slotsCargados`), no `1..n` ni `1..MAX_KEYS`. Sigue PENDIENTE el `agotado: null`
para cero cuentas: cambia el tipo `CuotaProv` que leen el board y la API, y hoy un
proveedor sin ninguna key sigue saliendo con una fila vacía en el slot 1.
*2026-09-16 api-mako-areas*

**Vive en:** lib/ia-cuotas.ts (`usoHoyPorCuenta`, `cuotasProveedores`, `ordenarCuentas`) ·
lib/anthropic-usage.ts (`cuenta`) · supabase/migrations/0132_uso_por_cuenta.sql ·
app/integraciones/IntegracionesBoard.tsx · *2026-08-12 reporte de Leila*

### ⚠️ Conectar la TERCERA key de Gemini empeoraba el mensaje: la fila «cuenta 1» era el TOTAL, y el tope de tokens estaba en la unidad equivocada

**Síntoma.** El dueño, con tres cuentas de Gemini cargadas y funcionando: *«No puede ser
que tengo 3 API de gemini conectadas y me dice que me quedé sin tokens»*. El panel le decía
**«Sin cuota hoy — 841,5k / 750,0k tok»**: el numerador por ENCIMA del denominador, que es la
forma en que este bug se delata y nadie miró.

**Causa 1 — la cuenta 1 y el total compartían casillero.** `claveCuenta(provider, 1)` devolvía
el nombre PELADO del proveedor (`'gemini'`), que es exactamente la clave donde el plegado
acumula el agregado de TODAS las cuentas. O sea que la fila «cuenta 1» del reparto mostraba
la suma de las tres keys medida contra el tope de UNA. **Cuantas más cuentas conectás, más
agotada se ve la primera** — el panel empeora con cada key que suma el cliente, que es lo
contrario de lo que el producto le promete.

Y se realimentaba: `ordenarCuentas` ordena por % consumido, así que la cuenta 1 salía siempre
la más gastada, se probaba ÚLTIMA y no la usó nadie nunca. Medido en ws9: **cero llamadas en
la cuenta 1 en treinta días**, con las cuentas 2 y 3 haciendo todo el trabajo. El propio
mecanismo que ocultaba el problema lo sostenía.

**Causa 2 — `tokensDia: 250_000` es el tope por MINUTO.** 250k es el TPM del free tier de
Gemini 2.5 Flash, cargado como si fuera el del DÍA: **1440 veces más chico**. `pctDe` toma el
MAYOR de los dos cocientes, así que el lado de los tokens reventaba a diario mientras el de
los pedidos —el que Gemini SÍ limita por día— nunca pasaba el 58%. Medido contra
`anthropic_usage`: **veinte días-workspace por encima de ese «tope», del 139% al 469%**
(ws9 el 05/08: 1.171.928 tokens en 144 pedidos), y Google contestó TODAS esas llamadas.

    ws9  18/09   21 pedidos / 841.511 tok   →  «sin cuota» por tokens,  8% por pedidos
    ws1  11/09  109 pedidos / 790.013 tok   →  «sin cuota» por tokens, 44% por pedidos

**Un tope que se revienta todos los días sin que el proveedor se queje no es un tope: es un
número inventado.** Los dos defectos son independientes y cada uno alcanza solo; juntos, el
panel decía «sin cuota» sobre tres keys sanas.

**⚠️ Y lo que más cuesta ver: esto ES la entrada de arriba, arreglada a medias.** El caso
de Leila (12/08) dejó de SUMAR las cuotas en el total y agregó el reparto por cuenta —
correcto, y sigue vigente. Lo que no tocó fue que el casillero de la cuenta 1 siguiera
siendo el del agregado, así que el mismo error volvió con el signo cambiado: antes el total
decía «te sobra» mientras una cuenta estaba muerta; ahora una cuenta decía «estoy muerta»
llevando el total de las otras. **Al des-sumar un indicador, revisá que cada parte tenga su
propio casillero** — si una comparte clave con el total, no lo des-sumaste.

**El diagnóstico obvio era el equivocado, otra vez.** Las hipótesis naturales —«las tres keys
son del mismo proyecto de Google», «alguna no descifra», «el clasificador del mensaje matchea
`exceeded` de más»— se midieron y se cayeron las tres: las 73 credenciales descifran, las tres
keys contestan HTTP 200, y el mensaje de chat ni siquiera era la superficie que él estaba
mirando. **Lo roto era el MEDIDOR, no las keys ni el texto.**

**La regla.** Un reparto por ítem no puede usar la misma clave que el total: si `clave(item_1)
=== clave(total)`, el primer ítem miente por construcción y encima arrastra a cualquier orden
que se calcule con él. Y todo tope de un tercero lleva su UNIDAD verificada contra el uso real
— si los datos que ya tenés lo pasan seguido y nadie se queja, el que está mal es el tope.

**Probado rompiéndolo** (`tests/ia-cuotas.test.ts`): con el casillero compartido fallan 3 de 6;
con el `tokensDia` de vuelta, 2 de 6; con los dos —el estado real de producción hasta hoy—
**5 de 6**.

**Lo que quedó SIN hacer:**
- `agotado: null` para un proveedor sin ninguna key (hoy sale fila vacía en el slot 1) —
  `lib/ia-cuotas.ts` `cuotasProveedores`, y el tipo `CuotaProv` que leen el board y la API.
- La ventana del contador corta a medianoche del SERVIDOR (UTC) y la cuota de Gemini se repone
  a medianoche **Pacific**: 7-8 h de desfase — `lib/ia-cuotas.ts:usoHoyPorCuenta`.
- El uso se registra **sólo en el ÉXITO** (`recordUsage` corre después de la respuesta), así
  que una key que devuelve 429 en cada llamada figura en 0% y `ordenarCuentas` la sigue
  poniendo primera — `lib/ai-cheap.ts`. Es el peaje del 429 que la rotación proactiva venía
  a evitar, vivo por el otro lado.
- `causaDelFallo` clasifica `'sin_cuota'` si **cualquiera** de los errores de la cascada
  matchea el regex (`quota|exceeded|insufficient|billing`), aunque las otras cuentas hayan
  fallado por otra cosa; no existe una causa «saturación» (503) ni «tu key es inválida» —
  `lib/fallo-ia-texto.ts`.
- Las keys de Gemini de ws9 son la «red de plataforma» de los clientes y ese consumo se anota
  en el workspace del CLIENTE con el slot de una key ajena — `lib/ai-cheap.ts:provsGratisDePlataforma`.
- La misma API key de Gemini está cargada en dos workspaces (tres pares medidos): dos gauges
  miden medio tanque cada uno y Google cuenta un solo proyecto.

**Vive en:** lib/ia-cuotas-calculo.ts (nuevo: `claveCuenta`, `LIMITES_PROVEEDOR`, `plegarUso`,
`pctDe`) · lib/ia-cuotas.ts (`slotsCargados`, `cuotasProveedores`, `ordenarPorCuota`,
`ordenarCuentas`) · lib/fallo-ia-texto.ts (`textoFalloIA` con `keysDelCliente`) ·
lib/mako-doer-in.ts:719,1229 · app/integraciones/IntegracionesBoard.tsx (`LIMITE_FREE.gemini`) ·
tests/ia-cuotas.test.ts · scripts/diag-gemini-cuotas.mjs · scripts/diag-gemini-panel.ts ·
*2026-09-19 gemini-sin-tokens (6 lentes × 2 refutadores, 106 agentes)*

### «0 operaciones recientes» no era un panel vacío: era un 403 pintado como cero

**Síntoma:** la misma clienta, con 24 llamadas hechas ese día, ve **«0 operaciones
recientes», $0.0000 y ningún historial**. El gauge de arriba —en la misma pantalla— sí
mostraba sus 240,6k tokens.

**Causa:** `/api/anthropic-usage` estaba gateada por un guard llamado `soloDueno`: super
admin de agencia, o admin del workspace **dueño**. Cualquier cliente recibía **403**, y el
board hace `if (j?.ok) setUsage(...)` — o sea que el rechazo dejaba `usage` en `null` y la
UI lo pintaba como ceros. **Un permiso denegado y un dato en cero se ven exactamente
igual**, y por eso nadie lo vio antes: la pantalla no estaba rota, estaba mintiendo en
silencio.

El guard no estaba mal cuando se escribió: la IA era UNA cuenta de la agencia y el gasto
era de la agencia. Con BYOK cada cliente pone su key, la gasta y la paga — el nombre
`soloDueno` describía un mundo que ya no existía. **Es el mismo desfase que este documento
ya registra dos veces**: el gauge que sumaba cuotas ajenas y el mensaje que pedía una key
al que ya tenía tres. Los tres son la misma deuda: lecturas escritas antes de BYOK que
siguen suponiendo «IA = agencia».

**Y abrir el guard, solo, habría abierto una fuga.** `getUsageSummary` mezclaba las filas
de Claude de OWNER_WS en TODOS los resúmenes (Claude era compartido). Con el panel
solo-dueño no se notaba; al abrirlo, un cliente habría visto el `motivo` de las
operaciones de la agencia — texto libre con nombres de otros clientes. Ahora es **una sola
lectura del workspace del request**, que para el dueño da lo mismo que antes y para un
cliente arregla las dos cosas a la vez.

**El corolario que faltaba:** `wsDeProveedor` mandaba el gasto de Claude SIEMPRE a
OWNER_WS. Con BYOK, un cliente con su propia `ANTHROPIC_API_KEY` paga él y ese gasto se le
sumaba a Mauricio, invisible para su dueño real. Ahora la pregunta correcta no es «qué
proveedor es» sino **de quién es la key que lo pagó**.

**Regla:** cuando una lectura devuelve 403 y la UI la trata como «sin datos», el bug es
invisible por diseño. Si un fetch puede fallar por PERMISO, el estado «no pude leer» no
puede colapsar en el estado «no hay nada».

**Vive en:** app/api/anthropic-usage/route.ts (`soloAdmin`) · lib/anthropic-usage.ts
(`getUsageSummary`, `wsDeProveedor`) · *2026-08-12 reporte de Leila*

### El mensaje de error se corrigió en 2 de 4 lugares, y el que faltaba era el que ella usa

**Síntoma:** «No hay IA para generar las razones. Conecta tu API key de Gemini (gratis) en
Integraciones» a alguien que tenía tres keys de Gemini cargadas y funcionando.

**Causa:** el problema estaba diagnosticado y resuelto — `avatares.ts` y `entregable.ts`
distinguían «no hay ninguna key» de «hay key y la cascada falló», con el comentario
explicándolo. Pero la corrección se aplicó **a mano, call-site por call-site**, y quedaron
afuera `generarRazones` (la Matriz, o sea la pantalla del reporte) y `angulos-formatos`.
Tres textos para el mismo problema, uno diciendo lo contrario que los otros dos.

**El detalle que lo hacía indiagnosticable:** ninguno de los tres decía QUÉ había contestado
cada proveedor. Ese dato existía —`chatCheapCascade` lo empuja a `erroresOut`, y hay
`console.warn` con el error crudo— pero los `console.warn` viven en los logs de Vercel, que
nadie lee y que a los 60 minutos no existen. La captura del reporte no tenía una sola pista.

**La regla (ya estaba en AGENTS.md, aplicada a medias):** si el que se tiene que enterar es
el usuario, el aviso va donde él mira. Ahora el mensaje incluye qué contestó cada cuenta —
`gemini · cuenta 1: HTTP 429 quota · gemini · cuenta 2: HTTP 503` — que es la diferencia
entre un reporte y una captura muda.

**Y la guarda, porque una frase copiada se vuelve a copiar:** el texto vive SOLO en
`lib/ia-mensajes.ts`, y `tests/ia-mensajes.test.ts` falla si (a) el literal «Conecta tu API
key de Gemini» aparece en el código de cualquier otro archivo, o (b) alguien lee el `''` de
la cascada y arma un `error:` sin haber pedido `erroresOut`. La segunda encontró un
call-site más que nadie estaba mirando (`setting-simulador`, que decía «MaKo no respondió.
Vuelve a intentarlo.» ante una cuota agotada — reintentar no arregla una cuota).

**Vive en:** lib/ia-mensajes.ts · lib/ai-cheap.ts (`errorDeCascada`) · tests/ia-mensajes.test.ts
· *2026-08-12 reporte de Leila*

### El tilde probaba la key VIEJA y pintaba verde la nueva

**Síntoma:** ninguno — ese es el punto. Se pega la segunda API key, el tilde dice «Guardada y
probada — funciona», y la key podría estar rota.

**Causa:** los pings de `lib/metodo-verificar.ts` leen la clave BASE (`v.GEMINI_API_KEY`). Al
mandar `GEMINI_API_KEY_2`, el valor efectivo de la base seguía saliendo de `credWs` —la key 1,
que ya estaba guardada y andaba— así que el ping daba OK **sin haber tocado la key nueva**. Es
el mismo antipatrón de la credencial que se pinta conectada y no se usa, pero al revés: se
pinta probada y no se probó.

**Regla:** cuando un formulario admite N valores para lo que el verificador conoce como uno
solo, el valor tipeado tiene que **pisar** al guardado antes del ping. Si el chequeo no puede
distinguir cuál de los N está probando, el verde no significa nada.

**Vive en:** lib/metodo-verificar.ts (`verificarServicio`, el bloque `extra`) · *2026-08-12
rotación multi-cuenta*

### Claude era el último recurso en el chat y el SEGUNDO en tool-use

**Síntoma:** ninguno visible; se paga y listo.

**Causa:** `chatClaude` ya recorría la cascada gratis entera antes de pagar (la regla de
AGENTS.md, «Claude es el ÚLTIMO recurso»), pero **`chatClaudeTools` no**: probaba UN proveedor
y ante cualquier fallo se iba a Sonnet. O sea la misma regla, cerrada en una mitad del sistema
y abierta en la otra, justo en el camino donde corre el doer y con el error más previsible de
todos (429 de Gemini en tandas).

**Cómo quedó:** `chatCheapToolsCascade` recorre todas las cuentas de los seis proveedores con
function-calling, ordenadas por cuota, y recién después se paga.

**La restricción que tiene y no se puede sacar:** si el proveedor que falló **ya ejecutó una
herramienta**, la cascada se corta y el error se relanza. Las tools del doer ESCRIBEN (crean un
borrador, mandan un mensaje): reintentar con otro modelo después de una acción a medias la
duplica, y un duplicado silencioso es peor que un error visible. Rotar es seguro solo mientras
no se tocó nada — que es exactamente donde caen los 429, en el primer request.

**Vive en:** lib/ai-cheap.ts (`chatCheapToolsCascade`) · lib/anthropic.ts (`chatClaudeTools`)
· *2026-08-12 rotación multi-cuenta*

### Los cinco `chatCheap` sueltos no rotaban nada

`chatCheap` habla con UN proveedor: si tira 429, el caller se queda sin nada aunque haya otras
cuatro IA gratis cargadas. Quedaban cinco call-sites así — dos títulos de chat (que además
caían a **Claude** por no poder titular), las sugerencias del Chat Agent (que devolvían 500) y
la calificación del simulador. Migrados a `chatCheapCascade`.

**Regla:** `chatCheap` directo es para cuando de verdad querés UN proveedor concreto. Si lo que
querés es «que salga», es `chatCheapCascade`. El que queda sin cascada hoy es el turno de charla
de `mako-doer-in`, que tiene su propio bucle sobre varios proveedores (lib/mako-doer-in.ts:840).

**Vive en:** app/api/chart-insights/route.ts · app/api/mako-doer/route.ts ·
app/api/chat-agent/secuencias/route.ts · lib/setting-simulador.ts · *2026-08-12 rotación
multi-cuenta*

## Comprar modelos: revendedores, mercados y precios de terceros

Nada de esto está implementado todavía. Es lo que hay que saber **antes** de meter un
proveedor nuevo en `lib/model-catalogo.ts` o de proyectar el costo de una feature que
genera imagen, video o voz. Salió de la corrida `pricing-paso-1-con-que-ia`
(*2026-08-09*, 4 agentes), que fue a leer las páginas de precios y **los términos** de
Kie.ai, APImart, fal.ai, Replicate, Groq, DeepSeek, Z.ai y Google.

### ⚠️ El «precio oficial» que declara un revendedor no es un dato: es un número derivado del suyo

APImart publica una columna «OFFICIAL PRICE» al lado de la suya. En las ~200 filas que se
revisaron, esa columna es **exactamente su propio precio × 1,25**. Siempre 20% de
descuento, en todos los modelos, de todos los proveedores. No es el precio de nadie: es
una referencia fabricada para que el descuento se vea. Dicen que el oficial de Veo 3.1
Fast 720p es US$0,08/seg cuando Google cobra US$0,10.

Kie.ai es menos mecánico —sus descuentos varían de 16% a 95%, o sea que la columna no está
generada— pero también infla: declara «oficial US$1,20» para Veo 3.1 Fast 720p cuando
Google cobra US$0,80 por esos 8 segundos. En Veo Quality 1080p, en cambio, su «US$3,20
oficial» **sí** coincide. O sea: no se puede confiar ni desconfiar en bloque, hay que
recalcular fila por fila.

**Regla:** el ahorro de un revendedor se calcula **siempre** contra
`ai.google.dev/gemini-api/docs/pricing` y `developers.openai.com/api/docs/pricing`, nunca
contra la columna del propio revendedor.

**Vive en:** todavía en ningún archivo — aplica al agregar cualquier proveedor a
`lib/model-catalogo.ts` · *2026-08-09 pricing-paso-1*

### ⚠️ Un número que viene de un curso no es un dato: el «Sora a US$0,15 por 15s» está roto por 8x

El material de AVATARHYPE (los cursos que ya están en `/conocimiento`) enseña a comprar
Sora en Kie.ai a **US$0,15 por 15 segundos** = US$0,01/segundo. Verificado el 9/8/2026:

- **Kie.ai hoy no vende Sora.** Buscar «sora» en sus 408 ítems de precio devuelve
  *«No pricing data found»*.
- US$0,01/seg es **10x por debajo** de la API oficial de OpenAI (US$0,10/seg) y **5x por
  debajo** de su modo batch (US$0,05/seg). Nunca fue un precio sostenible.
- El único Sora comprable en estos mercados es el de **APImart a US$0,08/seg = US$1,20 por
  15 segundos**: **ocho veces** lo que dice el curso.

El dato circuló dos veces sin verificarse —primero en el curso, después en un mensaje al
dueño— y en las dos ocasiones sonaba bien porque venía de una fuente propia. Es el mismo
patrón que el CAC de US$666 que se coló en la tab de pricing desde un benchmark de SDR
que el propio agente había marcado como «sin muestra publicada».

**Regla:** un precio sacado de un curso, un blog o un benchmark **no entra a una
proyección sin abrir la página de precios del fabricante ese día**. Los cursos avisan
ellos mismos que «el mundo de la IA cambia todo el tiempo»; el que los cita es el
responsable de la fecha.

**Vive en:** app/admin/dev/pricing/modelo.ts (todo número ahí declara su origen:
`medido` | `publicado` | `supuesto` — este caso es por qué existe ese campo) ·
*2026-08-09 pricing-paso-1*

### ⚠️ Los términos de reventa son parte del precio, y son lo único que nadie publica de frente

Se leyeron los cuatro contratos. Esto es lo que dicen, textual:

| Proveedor | ¿Se puede construir un SaaS que cobra encima? |
|---|---|
| **APImart** | **PROHIBIDO.** ToS (act. 2026-08-06) §4: *«Resell, redistribute, or white-label our API services without explicit authorization»*. Opera 杭州唤智网络科技有限公司, ley de China, tribunales de Hangzhou. Reclamo práctico desde LatAm: ninguno |
| **Kie.ai** | **NO DICE NADA.** Sus Terms (vig. 2025-08-01) no mencionan derechos sobre el output, ni uso comercial, ni reventa, ni que apliquen los términos de los proveedores upstream. **Un vacío contractual no es un permiso** |
| **fal.ai** | **PERMITIDO Y CONTEMPLADO.** Define «Customer Solution» y otorga derecho a *«allow End Users to access and use the Services through the Customer Solution»* — que es exactamente la forma de MaKo. Única restricción: no exponer la API cruda al cliente final |
| **Replicate** | **PERMITIDO, INCLUSO PARA VENDER EL OUTPUT:** *«grants to you all right, title and interest… including your use of Output for commercial purposes such as sale or publication, subject to any Third Party Terms»*. Ojo con esa última cláusula: Ideogram, por ejemplo, prohíbe usar su output para construir un competidor |

Y una nota aparte: **Freepik API es el único del lote que ofrece indemnización legal**
(plan Business). Si algún día preocupa que un cliente reciba un reclamo por un creativo
generado, es el único que pone la firma.

⚠️ **La fila de fal.ai contesta UNA pregunta y hay una segunda que contesta al revés.**
Que fal permita construir un SaaS encima es sobre **la key de MaKo** sirviendo a End Users.
Sobre **la key del cliente** dice lo contrario, textual (ToS act. 31/07/2026): *«You may not
share or permit others to use your individual account credentials»*. Replicate igual. O
sea: **MaKo puede vender generación de medios con su propia key, y NO puede ofrecer BYOK de
medios.** Un cliente que pega su key de fal para que MaKo la use es exactamente lo que esa
cláusula prohíbe. Es la línea dura del paso 3, y es lo que mata el «plan Studio con BYOK de
medios» antes de que alguien lo vuelva a proponer.

Para LLM el mapa es otro: de cinco contratos leídos (OpenAI, Google, Groq, Anthropic, fal)
**ninguno prohíbe explícitamente** que un tercero opere la key del titular, pero ninguno lo
bendice y los cinco cargan el 100% de la responsabilidad sobre el titular. No es «no se
puede»: es **«si sale mal, no hay a quién reclamarle»**. Falta chequear Vertex (service
accounts) y Bedrock (IAM), donde la delegación es un mecanismo diseñado a propósito y
probablemente sea el único BYOK contractualmente limpio.

**Regla:** antes de agregar un proveedor a la cascada, se leen sus términos de reventa. El
precio por token es la mitad del dato; la otra mitad es si se puede facturar encima.

**Vive en:** lib/ai-cheap.ts (la cascada) · lib/model-catalogo.ts · *2026-08-09 pricing-paso-1*

### El descuento uniforme es la firma de un canal gris, no de un acuerdo

Cuando el descuento supera lo que cualquier programa de reventa podría dar, no es
negociación: es otro canal. Las banderas concretas:

- Kie vende **todos** los modelos GPT a **exactamente −72%** y Gemini 3.1 Pro a −75%. Un
  descuento uniforme y redondo sobre una familia entera no sale de un acuerdo.
- Kie vende Runway 5s/720p a US$0,06 cuando la API oficial cuesta US$0,25 por esos mismos
  5 segundos (−76%), y ni declara precio oficial: pone N/A. **Vender por debajo del costo
  del proveedor solo se explica automatizando cuentas de consumidor.**
- Los dos venden **Midjourney, que no tiene API pública en 2026**. Toda «API de
  Midjourney» automatiza Discord o la web y viola sus términos. APImart lista 75 variantes;
  Kie ya no la lista (se reporta, sin fuente primaria, que la retiró cuando Midjourney se
  lo exigió — que es exactamente el escenario de «desaparece de un día para el otro»).

**Mérito para APImart:** es el único que separa los canales por nombre. Los endpoints
`-OFFICIAL` son pass-through al proveedor real; los `-EXT` son su canal propio y son los
baratos. Construir solo contra `-OFFICIAL` compra casi toda la seguridad a cambio de casi
todo el descuento.

**Dónde sí hay ahorro creíble** (20-65%, el que se puede meter en una proyección):
imagen 50-67% (APImart Nano Banana 2 EXT US$0,015/img, Z-Image-Turbo US$0,01/img; Kie Nano
Banana US$0,02/img); **Veo 3.1 Lite 720p en Kie a US$0,15 el clip de 8s** contra US$0,40
oficial (−62%); voz ElevenLabs multilingual v2 a US$0,06/1.000 chars (−40%).

**Arquitectura recomendada:** fal.ai o Replicate como camino principal (términos que sí
contemplan un SaaS), y Kie/APImart como capa barata **opcional** detrás de un router con
failover, solo en los modelos donde el descuento es creíble (Kling, Seedream, Wan, Flux,
ElevenLabs: 17-40%) y **nunca** en los que gritan canal gris (Runway, GPT, Gemini,
Midjourney, GPT-Image).

**Vive en:** lib/ai-cheap.ts (`chatCheapCascade` es el molde del router) · *2026-08-09 pricing-paso-1*

### ⚠️ Tres trampas de tesorería que no están en la tabla de precios

1. **Kie borra el media generado a los 14 días.** Si MaKo genera un creativo y guarda la
   URL de Kie en vez de los bytes, el creativo desaparece del historial del cliente sin que
   nada avise. Hay que copiar a storage propio en la misma pasada.
2. **APImart §6 se reserva ajustar cuántos créditos cuesta cada modelo «dynamically based
   on the model, the upstream provider channel, or operating costs».** Pueden subir el
   precio de un día para el otro, sin aviso. Un modelo de MaKo Tokens con margen fijo no se
   puede apoyar en eso sin colchón.
3. **Los créditos de fal.ai vencen a los 365 días** (los promocionales a los 90) y **no son
   reembolsables**. Es plata atrapada: no cargar más de lo que se consume en un año.
   Replicate es el único con pospago por consumo.

Y el contrato le gana al marketing: la doc de APImart vende «99.9% uptime guarantee», pero
su §8 dice *«we do not guarantee that our services will be available at all times»* y no
define ningún crédito por incumplimiento. Kie lo admite en su propia doc: *«Our overall
stability may be slightly lower than official providers»*.

**Vive en:** todavía en ningún archivo · *2026-08-09 pricing-paso-1*

### ⚠️ El precio no es del modelo: es del reasoning effort

Artificial Analysis lista **el mismo** DeepSeek V4-Flash con Intelligence Index **30**
(default), **40** (medio) y **52** (max). El precio por token no cambia; los tokens
consumidos sí, y mucho. **Cualquier proyección que use «índice 52» y «el precio de la
tabla» al mismo tiempo está subestimando el costo.**

Esto muerde por partida doble acá, porque ya está documentado que el `effort` se perdía en
Gemini y que un `reasoning_effort: 'minimal'` hardcodeado mataba el override
(ver [Topes](#topes) y el hallazgo del effort en Gemini). O sea: en MaKo el effort no es
solo un parámetro de calidad, es **el multiplicador del costo que hoy no se registra en
ningún lado**.

**Vive en:** lib/ai-cheap.ts (`effort`) · lib/anthropic-usage.ts (`cost_usd`, que no lo
mira) · *2026-08-09 pricing-paso-1*

### ⚠️ En tool-use agéntico ningún modelo barato pasa el 27%

Dato crudo de tau3-Banking (Sierra / Artificial Analysis): **el techo lo tiene GLM-5.2 con
27%**. No es que los baratos anden mal — es que **nadie** anda bien en flujos agénticos
multi-turno sobre un dominio real.

Ranking por evidencia independiente (no por lo que dice el fabricante):
**Qwen3.7-Max** lidera el Berkeley Function Calling Leaderboard v4 con 0,750 (13 modelos,
media 0,6, jul-2026) — la mejor señal de tool-use de un tercero que existe hoy. **GLM-4.5**
(77,8%) y **GLM-4.5-Air** (76,4%) fueron 1º y 2º de BFCL v3. **DeepSeek V4 Flash/Pro** son
1º y 2º de tau3-Banking.

Y los que **no** deben recibir tool-use multi-paso: gpt-oss-20b (índice 15), Llama 3.1 8B,
Amazon Nova Micro (índice 4) y Nova 2 Lite (índice 12). Ahí es donde se cumple lo que ya
sabemos: 20x más barato, pero falla y sale más caro.

**Consecuencia de diseño:** el doer de MaKo sobre un modelo barato necesita **verificación
determinista arriba**, no confianza. Es la misma regla de las dos capas que gobierna las
preguntas del Perro.

**Vive en:** lib/mako-doer-acciones.ts · lib/chat-claude-tools.ts · *2026-08-09 pricing-paso-1*

### Qué modelo barato va en cada tarea (agosto 2026)

Recomendación de la corrida, con el precio **confirmado contra la página del fabricante**
salvo donde se aclara:

| Tarea | Modelo | US$/M in · out | Por qué |
|---|---|---|---|
| Analizar llamadas (juicio, poco volumen, error caro) | **gpt-5.6-luna** | 0,20 · 1,20 | AA Index 51-52, el mismo nivel que Gemini 3.6 Flash que cuesta **7,5x** más en entrada. Con caché a US$0,02/M el system prompt del Closing se paga solo |
| Extraer tareas de una reunión larga | **Qwen3.7-Flash** | 0,03 · 0,13 | 1M de contexto: **mete el transcript entero sin trocear**, que es el problema que ya costó tiempo (ver [Topes](#topes)). ⚠️ **Cero benchmarks independientes de este modelo** — hay que probarlo contra casos reales antes de producción |
| Ídem, pero verificado | DeepSeek V4-Flash | 0,14 · 0,28 | También 1M de contexto, salida máx. 384K, y sí tiene benchmarks |
| Copy con voz de marca | **Kimi K2.6** | 0,95 · 4,00 | Acá el benchmark correcto **no** es el Intelligence Index sino LMArena (preferencia humana ciega, 386 modelos, 7,6M de votos): 1461, el más alto de los baratos |
| Clasificar contra una rúbrica | **GLM-4.7-Flash** | **gratis** | Confirmado en la tabla oficial de Z.ai. Contexto 200K, function calling declarado |
| Chatbot de WhatsApp (manda la latencia) | gpt-oss-120b en Groq | 0,15 · 0,60 | ~500 tok/s. Su índice es **24**: es rápido, no inteligente |

**Cuatro advertencias sobre esta tabla:**

1. **DeepSeek avisó que va a subir precios.** Texto literal en su página oficial: planean
   subir el precio general *«in the near future, with a significant increase expected»*. No
   armar el modelo de costos sobre US$0,14/US$0,28 sin plan B.
2. **Cerebras no es cotizable:** su página no publica precio por token (solo Free Trial /
   Developer / Enterprise a medida) y sus planes Code figuran agotados. Para una proyección
   financiera, afuera.
3. **Groq no publica su tabla de forma legible** (JS). Lo confirmado sale de
   `console.groq.com/docs/models`. Y el catálogo se mueve: el 21/7/2026 sacaron Llama 4
   Scout y Qwen3 32B.
4. **Cuando un leaderboard y el fabricante no coinciden, gana el fabricante.** LMArena
   lista Gemini 3.5 Flash-Lite a US$0,15/US$1,25 cuando Google dice US$0,30/US$2,50.

**Tiers gratis confirmados:** GLM-4.7-Flash y GLM-4.5-Flash (entrada **y** salida, tabla
oficial de Z.ai); todas las variantes Flash y Flash-Lite de Gemini; Groq con rate limits.

**Vive en:** lib/model-catalogo.ts · lib/ai-cheap.ts · *2026-08-09 pricing-paso-1*

## Prompts

### ⚠️ El prompt que leés en el archivo NO es el que recibe el modelo: brandSystem le antepone MAKO_NUCLEO

`brandSystem()` arma `[persona, MAKO_NUCLEO, rendered]`, así que las reglas de CHAT
(«Markdown: negritas, viñetas», «Nada de muros de texto», «el PRIMER mensaje 2-4 líneas»,
«NUNCA termines con una pregunta») van en **posición de máxima autoridad** delante de ~20
llamadas que esperan JSON estricto: mako-guardian, checklist-coach, plan-fathom, retro-gate,
post-llamada, ad-copy, email/generar, campaign-suggest. Contradice de frente al «Devolvé
EXCLUSIVAMENTE un objeto JSON válido (sin markdown)» del propio prompt, y el costo ya se
paga: `parseJsonObject` tiene que limpiar ```json a mano y plan-fathom loguea «la IA no
devolvió JSON válido» con reintento.

El verificador **refutó** que esto explique la brevedad de las respuestas, pero confirmó la
contradicción de formato como problema real y sistémico. Fix propuesto: partir el núcleo en
reglas de sustancia (siempre) y de formato conversacional (solo chat), con un
`brandSystemJson`.

**Vive en:** lib/mako-prompts.ts (`MAKO_NUCLEO`) · lib/campaign-structurer.ts:200 ·
lib/landing-writer.ts:139 · *2026-08-05 ~fathom-preguntas-lote-whatsapp-forense*

### ⚠️ Editar el template en el repo no cambia el prompt si hay un override guardado en la base

Las entradas del registro declaradas con `source: 'override'` se resuelven con
`getPromptText(key, fallbackTpl)`: el texto guardado en `app_settings['mako.prompt-overrides']`
**gana** sobre el default del código. Si en prod hay un override, tocar el template y pushear
no cambia nada y no hay ningún aviso. Excepción a tener presente: el slot `{{jsonShape}}` se
rellena SIEMPRE con la constante del código, así que el esquema JSON sí se puede cambiar
desde el repo.

**Corolario:** renombrar una key de prompt deja huérfanos el override y sus hasta 30
versiones de historial, y la IA vuelve al texto de fábrica **en silencio**.

**Regla:** antes de dar por hecho un fix de prompt, mirá el store.

**Vive en:** lib/prompt-registry.ts · lib/prompt-render.ts (`getPromptText`) ·
`app_settings['mako.prompt-overrides']` · *2026-08-05 ~fathom-preguntas-lote-whatsapp-forense*


**29/10/2026, plantillas reales: Un slot NUEVO en un prompt ya editado nunca llega: el experto de cada tab va en una key aparte.** (docs/plantillas-reales/)
- **Síntoma posible:** agregarle `{{plantilla}}` o `{{negocio}}` a `copywriter.editar.user`, `offer.turno.system` o
  `video_editor.chat.user`. Quien ya los editó tiene su versión guardada, sin el slot, y el dato no llega nunca, sin
  error.
- **Causa:** el override reemplaza el template entero. Además, los system de los chats de Video e Image son `sensitive`
  y `static-only` (llevan `{{catalogo}}` y `{{formato}}`), así que tocarlos no aplica nada.
- **Regla:** el método de un experto va en una **key nueva que el código suma** al system de siempre:
  - `copywriter.experto`, `video_editor.experto` e `image_editor.experto` son instruction sin slots;
  - `offer.experto` lleva sus slots y se suma solo si la conversación nació de una plantilla.

  El pedido de adaptar va en una key `user` nueva (`<grupo>.adaptar.user`). Una tab sin chat previo (AI Avatar)
  estrena su par (`ai_avatar.director.system` y `.user`). Después de tocar el registro, `verify-prompt-registry-sync`.

**Vive en:** lib/prompt-registry.ts · lib/copywriter/experto.ts · lib/editor-video/chat-prompts.ts ·
lib/image-editor/chat/prompts.ts · lib/offer-ia.ts · lib/ai-avatar/director-reglas.ts (todos del plan)

### ⚠️ Los prompts de la matriz de razones y de los ángulos nunca se registraron

`razones.system`, `razones.user` y `razones.guion` (los de `formatos.*` ya no existen: la recomendación de formatos se
sacó el 23/10/2026) se
resuelven con `renderPrompt(key, TEMPLATE_DEFAULT)` —o sea, están escritos como si fueran
editables— pero ninguna de esas keys existe en `lib/prompt-registry.ts` (grep verificado
vacío el 7/8/2026). Resultado: corre siempre el template hardcodeado y el usuario no los ve
ni los puede tocar. Es el caso «prompt no listado» que caza la skill
`verify-prompt-registry-sync`. Registrarlos es aditivo y no cambia comportamiento (el default
es el mismo template). Lo mismo pasa con `avatares.system` y `entregable.system`.

**Vive en:** lib/razones.ts:121-122,152 (`GUION_SYSTEM_TEMPLATE`) · lib/angulos-formatos.ts:120-150 ·
lib/prompt-registry.ts · *2026-07-28 mapear-onboarding-ajustes*

### ⚠️ `mako.voz_guia` tiene dos escritores que se pisan sin merge

La guía de voz es un solo string en `app_settings` que **cinco** consumidores inyectan entero
en sus prompts (nutrición, plantillas, simulador, post-llamada, el editor manual). Pero la
escriben DOS caminos que no se conocen: `destilarVoz()` (que la deriva de las transcripciones
de anuncios, disparada desde /api/mako/voz) y el paso «Tu forma de escribir» del onboarding
del Chat Agent (que la compone desde la evidencia de los chats más lo que contestó el dueño).
El último que corre borra el trabajo del otro, sin aviso y sin historial.

**Regla:** si un slot de `app_settings` tiene más de un escritor, o se define cuál gana o se
guarda la estructura en una key aparte y se DERIVA la prosa final (el patrón de
`mako.archivero.manual`). Y si alguna vez se guarda JSON en `mako.voz_guia`, se rompen los
cinco consumidores y el editor manual de una.

**Vive en:** lib/nutricion-generator.ts:95 (`setVozGuia`) y :122 (`destilarVoz`) ·
app/api/chat-agent/onboarding/contexto/route.ts:79 y :158 · app/api/mako/voz/route.ts:58 ·
*2026-08-02 ~investigar-onboarding-chat-agent*

### Cuando un texto generado sale pobre, el culpable no es el prompt que lo genera: es el último que lo escribe

La queja era «Fathom resume demasiado y no cita a los invitados». Tres agentes independientes
le apuntaron a `lib/plan-fathom.ts` (el «1-3 frases» del JSON_SHAPE, los ejemplos con
`detalle:'…'`, los `slice(0,600)`). Los verificadores lo tumbaron: **ese detalle nunca llega
al tablero**. Apenas se crean las tarjetas corre el Perro, y `checklistsParaTareas`
REESCRIBÍA el detalle desde cero pisando el de MaKo, viendo como insumo solo los primeros
**220 caracteres**. O sea: el eslabón corto no era el que se medía, y arreglar el prompt de
extracción no habría cambiado nada visible.

**Regla:** seguí la cadena hasta lo que se PERSISTE, y medí sobre la tabla final, no sobre la
salida del primer modelo. (El fix ya está: `fusionarDetalle` + ventana de 4000, con el
comentario «4000, no 220: ACÁ estaba el cuello».)

**Vive en:** lib/plan-board.ts · lib/todo-guardian.ts · lib/checklist-coach.ts
(`checklistsParaTareas`) · lib/plan-fathom.ts · *2026-08-05
~fathom-preguntas-lote-whatsapp-forense*

### Un contrato que «no se cumple» puede que nunca haya corrido

Todo el diagnóstico de «Fathom ignora su propio piso de 600 caracteres» se hizo sobre tareas
extraídas ANTES de que el contrato existiera: el piso y el formato de 4 partes entraron el
5/8 a las 14:58 y la última extracción real en prod había sido el 3/8 a las 20:43. Los
77-226 chars medidos venían de corridas con el override a `gemini-flash-latest` y el
`reasoning_effort` minimal, las dos causas ya arregladas en ese mismo commit.

**Regla:** antes de reescribir un prompt por incumplimiento, comparar la fecha del último
dato de producción con la del commit que creó la regla, y recién después mirar qué modelo la
corrió de verdad. **Corolario:** la sonda barata (re-extraer una reunión ya cacheada con
`reanalizar:true`) decide si hace falta construir el reintento o no.

**Vive en:** lib/plan-fathom.ts:224 (piso) y :226 (formato) · cachés en `app_settings`
`mako.fathom.cache.<recordingId>` · *2026-08-06 contexto-de-todas-las-tareas*

### Decisión: todos los prompts hardcodeados pasan a /configuraciones, con su contexto explicado

«Todos los prompts impuestos en codigo, todos todos» *(2026-06-29)*: el dueño quiere poder
ajustar el comportamiento de MaKo él mismo, sin tocar código. Es la razón por la que existe
el registry — y por la que un prompt sin registrar (arriba) es una regresión, no una omisión
inofensiva.

### ⚠️ Pendiente: catálogos y definiciones que deberían ser editables y no lo son

- Sección en super admin para editar el **catálogo de causas/palancas** del diagnóstico y los
  **ángulos de guion con sus instrucciones por ángulo**. *(2026-07-11)*
- Definir bien `getSenalesRecon` **con ejemplos** (¿qué es una señal RECON? ¿qué es
  INTENCIÓN?) y detectar en el código otros conceptos que estén sin ejemplos. *(2026-07-11)*
- Aprovechar las skills de marketing de skills.sh (marketing-psychology, copywriting,
  email-sequence) para toda la redacción, más una vista de admin donde él vaya cargando
  ejemplos de emails que recibe. *(2026-07-10)*

---

## Topes

### ⚠️ El `maxTokens` que se le pide a `leerDocumentoIA` NO llegaba a Gemini, que es el camino de VISIÓN (6/11/2026)

`leerConGemini` armaba el pedido al endpoint nativo con `generationConfig: { temperature: 0, response_mime_type }` y **nunca
`maxOutputTokens`**: el tope que pidiera quien llama se perdía en silencio y valía el default del modelo. Y ése es el camino
PRINCIPAL de todo lo que mira una imagen o un PDF: «Editar» un carrusel pide 8.000 tokens de salida para que el JSON de hasta
12 láminas entre (`TOKENS_DE_SALIDA`, lib/carruseles/replica-servidor.ts) y el pedido salía sin pedir nada. El día que algo
pida más de lo que el modelo da por defecto, la respuesta vuelve cortada —y una respuesta cortada no se distingue de «la IA no
contestó»: `leerReplica` da «no pude leerlo» y el cliente ve la guía.

Lo mismo al revés vale para la capa barata, donde el default sí existe y es chico: `chatCheap` manda
`(opts.maxTokens ?? 512)`, así que **el que no pide tope pide 512**. Por eso el camino de respaldo de «Editar» cortaba un
carrusel entero (docs/hallazgos-carruseles.md, «el camino de respaldo era más débil que el principal»).

**La regla:** un tope de salida que el llamador pide tiene que VIAJAR en el pedido, y se comprueba leyendo el cuerpo que sale,
no el argumento que entra (`tests/carruseles-editar.test.ts` lo hace con la red de mentira: la cascada corre de verdad y el
test mira el JSON que le llega al proveedor). Sin `maxTokens` se sigue mandando sin nada, como antes.

**Por qué esto se puede tocar sin miedo, medido:** de los 16 llamadores de `leerDocumentoIA` (El Archivero, contratos, recibos,
fiscales, el manual de marca, avatares, anuncios…) **el único que pasa `maxTokens` es «Editar» un carrusel**. Para todos los
demás el pedido sale igual que antes, porque no piden tope. O sea que el campo estuvo muerto todo este tiempo: el primer
llamador que lo usó fue el primero en descubrir que no servía.

**Vive en:** lib/ai-cheap.ts (`leerConGemini`, `chatCheap` → `paramsDeSalida`) · 6/11/2026

### ⚠️ Con el tope viajando, el JSON se cortaba igual: la SANGRÍA se comía la mitad, y un JSON cortado pasaba como respuesta (11/11/2026)

«Editar» un carrusel de 6 láminas en el ws9 fallaba una vez de cada dos con «La IA no devolvió el diseño en un formato que
pueda leer». El diagnóstico obvio era «8.000 tokens no alcanzan, hay que subir el tope», y **era el equivocado**: subirlo no
entra en el plazo. `gemini-3.8-flash` escribe unos 80 tokens por segundo, 8.000 ya son 100 s y el plazo de la llamada es
120 s. Medido en `anthropic_usage` y con el crudo de la respuesta (el volcado de `fetch` sobre
scripts/carruseles-probar-editar.mts):
- con `response_mime_type: application/json`, Gemini devuelve el JSON **con sangría**: 588 líneas y 6.194 espacios para 6
  láminas. Midió 5.374, 7.904 y **7.996** tokens visibles en tres corridas del mismo carrusel. La de 7.996 se cortó a mitad
  de una clave;
- pidiéndolo «compacto, en UNA sola línea» (`COMPACTO`, lib/carruseles/replica.ts), el mismo carrusel salió en 1 línea con
  **3.273 tokens** y 72 s. Gemini lo respeta aunque el modo JSON esté prendido;
- `leerConGemini` **no miraba `finishReason`**. Un JSON cortado volvía como texto bueno, `probarCon` lo daba por respondido
  y nunca probaba el modelo de respaldo (`gemini-flash-lite-latest`). Pasaba directo a «no pude leerlo», y de ahí a las guías.

**La regla:** con `json`, una respuesta que terminó en `MAX_TOKENS` **tira** y la rotación pasa al modelo siguiente. Un
texto cortado todavía sirve; un JSON cortado, no. Sin `json` se devuelve como siempre. El formato que se le pide al modelo
también cuesta tokens y segundos, así que un JSON de salida grande se pide compacto. `thoughtsTokenCount` (778 y 1.603 en esas
corridas) viene aparte de `candidatesTokenCount`, que es lo que registra el uso.

**Vive en:** lib/ai-cheap.ts (`leerConGemini`), lib/carruseles/replica.ts (`COMPACTO`); el test en
tests/carruseles-editar.test.ts (caso `cortado`, roto a propósito las dos cosas: 10/1 cada una) · 11/11/2026

### ⚠️ Un modelo de Gemini que se cuelga se come el plazo ENTERO, y el plazo es por llamada, no por pedido (6/11/2026)

Medido con la red instrumentada en «Editar» un carrusel, dos veces el mismo día: `gemini-flash-latest` no contesta y aborta a
los **120,0 s** (el `timeoutMs` que pasó quien llamó), y recién entonces `gemini-flash-lite-latest` contesta en **8,4 s**. En
otra corrida el principal devolvió 503 en 8,1 s y el respaldo contestó en 8,7 s: el mismo pedido salió en 33 s o en 277 s según
si el primer modelo se colgaba o rebotaba rápido. La cascada funciona —siempre contestó alguien—, pero **el presupuesto de
tiempo no existe como concepto: cada escalón arranca con su propio plazo completo**, y el total puede pasar el `maxDuration` de
la ruta que lo llamó (300 s en `app/api/image-editor/carruseles/replicar/route.ts`). Cuando eso pasa, el stream se corta sin
mandar el final y la pantalla espera para siempre: no hay error, hay silencio.

Un comentario que dice «tarda de 20 a 90 s» al lado de un `maxDuration = 300` es lo que hace que nadie vea el riesgo. Las
mediciones de una ruta que llama a una cascada van con el PEOR caso medido, no con el típico.

**Vive en:** lib/ai-cheap.ts (el plazo por intento) · app/api/image-editor/carruseles/replicar/route.ts (`maxDuration`) · 6/11/2026

### ⚠️ `effort: 'low'` NO apaga el razonamiento de Claude: el único knob es `thinking: false`

Se elige `effort:'low'` creyendo que así la llamada sale rápida y barata, y el modelo sigue
razonando igual. En `chatClaude` el esfuerzo solo baja cuando thinking ya está apagado:
`thinkingOn = opts.thinking ?? true` y `effort = thinkingOn ? (opts.effort ?? DEFAULT_EFFORT) : 'low'`;
con `thinkingOn` se manda `payload.thinking = { type: 'adaptive' }` SIEMPRE y el `max_tokens`
por defecto salta a 16000. O sea: bajar el effort no reduce el pensamiento, y el pensamiento
se come el presupuesto de salida. Para una tarea chica (un título, una clasificación) hay que
pasar `thinking: false`, que además fuerza effort `'low'` y `max_tokens: 512`. **Verificado
vivo en el código de hoy.**

**Vive en:** lib/anthropic.ts:76-89 (`chatClaude`) · *2026-07-16 ~perro-ataja-duplicados-al-crear*

### ⚠️ El tope está escrito dos veces: en el `.slice()` y en el texto del prompt

Subir el `.slice(0, 3)` no cambia nada porque el modelo sigue devolviendo 3: el número está
literal en el system, en el user, en el ejemplo de forma del JSON y hasta en las reglas
conceptuales («los 3 tienen que ser genuinamente DISTINTOS»), además de los comentarios de
cabecera que quedan mintiendo. Y hay un corte que no está donde parece: en razones el slice
es **por avatar**, adentro del bucle de filas, no sobre el total. Encima ninguno de esos
prompts está dado de alta en el registry (ver [Prompts](#prompts)), y `renderPrompt` igual
honra un override guardado, así que un prompt viejo con el 3 le ganaría al código nuevo.

**Regla:** la cantidad va como constante exportada y como slot `{{cuantos}}` del template,
nunca como literal duplicado.

**Vive en:** lib/avatares.ts:99,107,118,124 · lib/razones.ts:122,132,141,155 ·
lib/entregable.ts:77,94,100 · lib/prompt-registry.ts · *2026-08-06
~fabrica-creativos-y-ads-writer-research*

### ⚠️ Si la Retro va justa de tiempo, publica sin verificar y no lo dice

El pipeline de la Retro son 8 fases con ~9 llamadas a Opus; la última es una verificación que
re-chequea los números del borrador del «cerebro». Cuando la corrida se acerca al límite de
**500s**, esa fase se SALTA y el borrador se publica igual, sin ninguna marca de que no pasó
el doble-chequeo. Un informe con la fuga en dólares que nadie verificó se lee exactamente
igual que uno verificado.

**Regla:** si se saltea la verificación, el resultado se rotula. Un degradado silencioso en
la pieza que dicta la tesis del negocio es peor que fallar.

**Vive en:** lib/retro.ts, lib/retro-reporte.ts (presupuesto de 500s) · *2026-07-19
~landing-24-features-auditoria*

### Regla: nunca le pongas un techo numérico a la IA

Ni cantidad de preguntas, ni de tareas, ni de opciones. Se le dan ejemplos y criterio, no
jaulas: la IA decide cuántas y si ninguna. «No le limites al perro para que genere de 0 a 3
preguntas, es una IA, que lo decida él cuántas preguntas tiene que generar o si no tiene que
generar ninguna»; «tengo miedo de estar metiendo muchas trabas y validaciones al flujo… para
eso es IA. Tal vez darle estos ejemplos, pero que pueda salirse»; «MaKo NO debería limitarse a
solo 4 preguntas» *(2026-07-11)*.

Lo mismo con los límites de producto: **no poner topes arbitrarios** (ni horas de agenda, ni
ventana de días de un público, ni cantidad de resultados). «No limites las horas, que se pueda
agendar a la madrugada si quieren» *(2026-08-07)*. **El tope lo pone la API, no nosotros.**

Y del otro lado: la IA genera **en cantidad** —100 avatares, razones o lead magnets, no 3—,
elige la mejor y deja el resto disponible para que el usuario la cambie: «aprovechemos la IA y
no la limitemos en la generación» *(2026-08-06)*.

### Regla: las transcripciones no se resumen nunca; se trocean

«No estarás resumiendo las transcripciones?… La transcripción no debería resumirse»
*(2026-07-24)*. El modelo resume solo si el techo de tokens lo aprieta: el troceado es la
respuesta, no un prompt que le pida ser más largo.

---

## Lo que le llega al modelo

### ⚠️ «No tiró» no es «hay dato»: los ceros estructurales entran al prompt como catástrofe

**Síntoma:** con solo Meta conectado, la Retro no sale flaca: sale **mentirosa**. «ROAS cash
0.00x: gastaste $X y facturaste $0» y «CUELLO del funnel: Formulario → Agenda 0.0%». El mismo
agujero está en /general: con cero fuentes comerciales el veredicto del semáforo cae al else
final y certifica «el negocio está sano, sin focos activos», cuando en realidad no sabe nada
— y eso es lo primero que ve un cliente en su primer login.

**Causa:** las áreas se omiten cuando su query tira o devuelve null, pero `getRevenuePeriod` y
`getFunnelEtapas` **no explotan** con `leads`/`pagos` vacíos: devuelven CEROS. `textoRevenue`
marca `hayAlgo=true` apenas la query no explota, y `roas_cash = spend>0 ? cash/spend : null`
da 0, no null. Con `MIN_MUESTRA=3` el cuello gana siempre con severidad 1.0. La Fase 6 de
verificación NO lo atrapa: su regla es «un número citado que no sale de datos», y el 0 **sí**
está en datos.

**El mecanismo de honestidad ya existe y está desconectado:** `getFunnelEtapas` acepta un
`sourceMap` para marcar `fuente_pendiente` y `retro-fuentes` simplemente no se lo pasa; y
`lib/sources.ts` ya separa conectada-y-fresca, conectada-sin-datos-recientes y desconectada,
pero ni los prompts ni el semáforo usan la distinción.

**Regla:** el gate de un área es la FUENTE conectada, no que la query no reviente. Todo
consumidor de métricas necesita el cuarto estado «sin datos suficientes para opinar, conectá
esto». **Corolario:** el catálogo de métricas que ve el cerebro tampoco se filtra por fuente,
así que pare experimentos sobre métricas estructuralmente nulas que jamás pueden concluir (la
Retro real #6 creó uno con `metrica=vsl_views` y objetivo 0).

**Vive en:** lib/retro-fuentes.ts:238 y :363 · lib/queries.ts:794 y :1278 ·
lib/retro-pipeline.ts:440 (`recolectarDatos` no recibe `areas`) · lib/sources.ts ·
app/general (semáforo) · *2026-07-16 mako-onboarding-solo-meta + 2026-08-05
~verificar-commits-contra-el-board*

### ⚠️ Quedan dos call-sites que colapsan el avance del VSL de NULL a 0

La regla «no medido ≠ no miró» ya está escrita y `getVslEngagement`/`getVslEngagementMap` se
arreglaron, pero la auditoría dejó dos consumidores sin tocar y ninguno avisa:
`lib/lead-insights.ts:267` hace `Math.max(0, ...eventos.map(e => e.porcentaje ?? 0))` y le
dice a la IA «retención máxima 0%» —es el único lugar donde el número se convierte en prosa—;
y `lib/nutricion.ts:340,358` usa `(max_pct ?? 0) >= 50`, así que mientras faltó el dato NADIE
cayó en la rama «vio el VSL» y toda la nutrición clasificó mal. Sumar: `lib/vsl-retencion.ts`
(`curvaRetencion`, `histogramaAbandono`) sigue sin un solo call-site, y `landingRecibioEventos`
(`lib/landing-token.ts:116`) mira `landing_visits`, que estaba sano, y por eso /integraciones
pintaba verde con la retención muerta.

**Vive en:** lib/lead-insights.ts:267 · lib/nutricion.ts:340,358 · lib/vsl-retencion.ts ·
lib/landing-token.ts:116 · *2026-08-06 crm-tracking-import-export-audit*

### ⚠️ El paso anterior del onboarding fabrica el dato que la Retro después denuncia

El wizard llama `seedNutricionTemplates()` en el paso 'funnel', y esas 5 secuencias nacen con
`activa:true` y 0 inscriptos (verificado en el ws3 de prod). Dos pasos después, la Retro las
lee y emite el finding «N secuencias activas con 0 inscriptos y 0 enviados» como anomalía del
negocio del cliente — un problema que creamos nosotros mismos, minutos antes, en el mismo
wizard. Y encima la regla 2 de cobertura («Nutrición sin secuencias activas») queda SUPRIMIDA
justamente porque las seedeadas están activas: el hueco real ni se declara.

**Regla:** un dato sembrado por default no puede alimentar un diagnóstico; o nace apagado, o
el diagnóstico lo distingue.

**Vive en:** app/api/onboarding/route.ts:179 (`seedNutricionTemplates`) ·
lib/retro-datos.ts:399-435 (`detectarCobertura`) · *2026-07-16 mako-onboarding-solo-meta*

### ⚠️ Cambiar la forma del modelo bajo la MISMA setting key es una migración silenciosa

El Avatar pasó de `{nombre,descripcion,dolor,deseo}` a
`{nombre,segmento,senalesMeta,situacion,dolor}` manteniendo `SETTING_KEY='mako.avatares'`, y
`getAvatares` seguía haciendo `(arr as Avatar[]).filter(a => a?.nombre)` sin normalizar.
Verificado contra prod: ws1 tenía 3 avatares guardados con la forma vieja, así que los campos
nuevos volvían `undefined` y se interpolaban al prompt de ángulos como texto literal
«Segmento: undefined · Situación: undefined», contaminando la entrada de Claude; además el
editor inline reventaba con TypeError al hacer `valor.trim()` sobre undefined. `tsc` no lo
caza porque el dato entra por un cast desde JSON.

**Regla:** si cambiás la forma de lo que guarda una key de `app_settings`, o cambiás la key o
normalizás al leer, con `''` por defecto para cada campo. El cast `as T[]` no es una
validación.

**Vive en:** lib/avatares.ts (`getAvatares`/`avataresTexto`) · app/onboarding/AvataresView.tsx ·
lib/angulos-venta.ts · *2026-07-28 ~review-avatares-angulos-onboarding*

### ⚠️ Un texto de fallback de la UI se cuela en el historial que ve el modelo

Cuando faltaba el audio, la burbuja de apertura se armaba con `texto: 'Tu nota de voz'`, y el
historial que se le manda al modelo se construye con `msgs.map(m => m.texto).filter(Boolean)`:
el primer turno que veía el lead simulado era literalmente «Tu nota de voz», una frase que
nadie dijo. En el camino bueno `texto` es `null` y se filtra solo. O sea: un bug de
reproducción degradaba también la calidad de la IA, sin que nada lo mostrara.

**Regla:** marcá los mensajes de chrome/fallback y excluilos SIEMPRE del historial del prompt;
no dependas de que el camino feliz los deje en null.

**Vive en:** app/chat-agent/OnboardingChatAgent.tsx:604-613 y :643-645 · *2026-08-02
~diagnostico-audio-ensayo-chat-agent*

### ⚠️ Un `tool_result` no tiene tope en Claude, y en la cascada barata tiene uno MUDO

**Síntoma:** una tool que devuelve un blob revienta el turno siguiente del doer. Se vio con el
snippet del Pixel: 86.387 caracteres (detalle en [hallazgos-landing.md](hallazgos-landing.md)
→ «El "código que se pega" son 86 mil caracteres»).

**Causa:** los dos bucles de tools hacen cosas distintas con la salida de `runTool`, y ninguna
salva. `chatClaudeTools` la mete entera en el `tool_result` (lib/anthropic.ts:381-389).
`chatCheapTools` la corta con `out.slice(0, 12000)` sin decirlo (lib/ai-cheap.ts:813-815): un
JSON de 86k le llega al modelo como 12k de JSON cortado, sin marca de recorte, y razona sobre
un pedazo creyendo que es todo. Y el runner del registro de la API devuelve la lectura tal cual
(lib/api-mako/ejecutar.ts:173).

**Regla:** toda tool que pueda devolver algo grande (un script, un HTML, un volcado) lo recorta
ella —diciendo que recortó y cuánto medía— o devuelve un link y el largo. El bucle no te salva:
uno no corta y el otro corta sin avisar.

**Sin hacer:** el `slice` mudo de lib/ai-cheap.ts:815. Si queda un tope, que diga que cortó.

**Vive en:** lib/anthropic.ts:381-389 · lib/ai-cheap.ts:813-815 · lib/api-mako/ejecutar.ts:173 ·
*2026-09-16 api-mako-areas*

### ⚠️ El RAG lee el conocimiento del ws 1 desde todos los workspaces, y el ws 1 es un cliente

**Síntoma:** no se ve. Una búsqueda sin área de cualquier cliente puede traer términos del
glosario del negocio de Mauricio. Y sin `OPENAI_API_KEY` de plataforma, la tool contesta «No
encontré nada relevante en el conocimiento cargado» sobre un conocimiento que está.

**Causa:** `wsParaRag()` (lib/mako-knowledge.ts:49-53) devuelve `[ws, OWNER_WS]` con el
comentario «método curado de la agencia». Pero `OWNER_WS` es Mauricio, un cliente (AGENTS.md →
«`OWNER_WS` NO es la plataforma»): todo lo que él cargue en `mako_knowledge` entra en
`searchKnowledge`, `listActiveKnowledgeByArea` y `listKnowledgeAgencia` de cualquier otro
workspace. Sin área pedida, `searchKnowledge` saca solo las reservadas
(`AREAS_RESERVADAS = [ejemplos, producto]`, :39; filtro en :193), y el glosario vive en la
misma tabla con `area='glosario'` (lib/glosario.ts). Buscan sin área: la tool
`buscar_conocimiento` (lib/mako-tools.ts:253-258), que sale por WhatsApp, por el chat, por
`/api/agente/consultar` y por `/api/v1/negocio/buscar_conocimiento`; el contexto de MaKo
(lib/mako-context.ts:91), y tres writers (lib/campaign-structurer.ts:181,
lib/ig-writer.ts:208, lib/landing-writer.ts:159). La lectura dedicada al glosario propio
(`glosarioPropio`, lib/api-mako/areas/negocio.helpers.ts:352, con `getTenantDb`) no tiene el
problema; la búsqueda general, sí. En las reuniones ya muerde por `listActiveKnowledgeByArea`:
ver [hallazgos-plan.md](hallazgos-plan.md) → «El glosario del ws 1 entra en las reuniones de
TODOS los clientes».

**Y dos vacíos que mienten.** Sin la key de OpenAI, `embed` tira (lib/embeddings.ts:25) y el
`catch { return []; }` de `searchKnowledge` (:198-200) lo vuelve cero resultados; un error de
lectura de la base también da `[]` (:189). `listActiveKnowledgeByArea` hace lo mismo ante un
error (:213). En los tres, «no pude buscar» y «no hay» salen iguales. La def de la API lo avisa
en la descripción de `buscar_conocimiento`; la tool vieja, no.

**Regla:** lo que se comparte entre workspaces se resuelve por `wsSuperAdmin()`, nunca por
`OWNER_WS`, y por lista BLANCA de áreas, no por lista negra. Un buscador que no pudo buscar lo
dice.

**Sin hacer:** todo. `wsParaRag` sigue en `[ws, OWNER_WS]` y el filtro sigue siendo de
exclusión.

**Vive en:** lib/mako-knowledge.ts:39, 49-53, 170-215 · lib/mako-tools.ts:253-258 ·
lib/mako-context.ts:91 · lib/glosario.ts · lib/embeddings.ts:25 · *2026-09-16 api-mako-areas*

### Regla: la IA filtra, y si no es concluyente no concluye

«Es MUY importante que FILTRE la IA, y en caso de que NO sea concluyente, que no lo ponga»
*(2026-08-02)*: cuando la fuente no alcanza para concluir, no se inventa una conclusión — se
pasa a preguntas personalizadas, igual que el archivero. Y si la fuente externa no trajo el
dato, **se muestra que no lo trajo**: «No quiero que MaKo a la fuerza me de una respuesta si
Meta no trajo nada» *(2026-06-24)*.

### Regla: lo que dice el usuario es input, no verdad

«NO condicionar el análisis y tomar por ciencia cierta lo que te diga el usuario para el
análisis, se puede equivocar» *(2026-07-01)*. El dato del usuario entra como una fuente más,
no reemplaza el análisis ni lo condiciona. Su versión más dura, para el Perro: «Los clientes
MIENTEN, EXAGERAN, SON EMOCIONALES, NO SABEN PRIORIZAR».

### Regla: ningún dato cargado a mano es ley, y nunca se pregunta lo que ya está en la base

«Siempre si hay docs que traen mejor data se debe sobre escribir. Ningún dato a mano es ley»
*(2026-07-27)*. Del otro lado: «Si ya hay un token de Gemini NO me lo pidas nuevamente… no me
debe preguntar random si tengo otros documentos» *(2026-07-29)*. Si falta un documento
puntual, se pide **ESE**, no «¿tenés más?»; lo que se puede autocompletar con data previa, se
autocompleta. «La idea justamente es APROVECHAR la info, que la IA haga el trabajo, no hacer
que el usuario cargue todo nuevamente» *(2026-08-05)*.

### Regla: lo analizado no se re-analiza, y el feedback se guarda para reusar

«Cada vez que toco a analizar esa reunión para extraer la data, me consume créditos… Ese
análisis debe guardarse en algún lugar» *(2026-07-19)*. Y lo mismo con el aprendizaje:
«Tienes que ir guardando todos estos feedback para que nos sea más fácil crear los próximos»
*(2026-07-22)* — el feedback y los aprendizajes se guardan y se reusan en las próximas piezas
**y en todos los orígenes**, no se pierden en el chat. Su lugar es CONOCIMIENTOS, no un md
suelto: «mucho mejor si te guias de ahí y no vamos guardando en un md vacio las cosas
importantes» *(2026-07-24)*.

### Decisión: el contexto de MaKo se inyecta de forma ADITIVA

RAG + fases: si una pieza está vacía, MaKo se comporta exactamente como hoy. Los embeddings
reusan la `OPENAI_API_KEY` que ya está en el repo y solo se re-embebe cuando cambia el cuerpo
de la entrada. «No quiero romper el comportamiento actual ni tocar el resto del dashboard» /
«no sumar otro proveedor». *(2026-06-21)*

### Decisión: los cursos son el RAG de MaKo, pero la info no se carga cruda

Pasa por un proceso de razonamiento previo para adaptarla: «este curso de AvatarHype, está muy
para productos, debemos pasar por un proceso de razonamiento tu y yo para cargar esa info»
*(2026-07-21)*. Los cursos son **generales de MaKo** (no por workspace) y se clasifican por
área (imágenes y video con IA, oferta, nutrición…). La curación se hace **desde Claude Code**
y se guarda en /conocimientos para poder revisarla: «de hacerlo dentro de la app, me
consumiría muchísimos créditos de la API». El contenido de /conocimientos se puede compartir
por link público, sin login: «que yo le pueda pasar un link a cualquiera y pueda acceder a
eso» *(2026-07-27)*.

---

## El doer

### ✅ Un agente que no llama la tool no falla: CONTESTA — y su prosa sale al WhatsApp del dueño

**Síntoma (9/8/2026):** el dueño pidió cargar dos tareas al plan y MaKo le contestó con
el borrador ENTERO como texto — las preguntas del formulario en el chat y un
«**Eliminar** — Nada por ahora». Sus palabras: «no entiendo qué hizo».

**Tenía razón literal: no hizo nada.** No hubo INSERT, no hubo id, no hubo link. Lo que
salió era el `input_schema` de `proponer_tareas_plan` aplanado a markdown, campo por
campo: «Qué hay que hacer / Por qué / Detalles concretos» es `MOLDE_DETALLE`, incrustado
literal en la `description` del campo `detalle`; «Preguntas» con `(opcion)`/`(comparacion)`
es el enum de `tipo`; «Eliminar» es una propiedad opcional del schema. Con un modelo chico
el schema viaja como **prompt plano**, indistinguible de una instrucción — «copiá esta
forma exacta» se lee como «escribí esto».

**El diagnóstico obvio era el equivocado, dos veces.** (1) No fue el modelo: el día
anterior acertó CUATRO veces con el mismo modelo y la misma ruta. (2) No fue una
regresión: la línea culpable es idéntica los dos días. La causa es que el código aceptaba
cualquier texto —`if (r.text && !r.text.startsWith('('))`, o sea «que no empiece con
paréntesis»— así que «este turno crea un borrador» no existía como decisión del código:
la tomaba el modelo emitiendo un tool_call, y si no lo emitía, su prosa salía derecho.
La fiabilidad quedaba colgada del modelo.

**Y la guarda evidente tampoco servía.** `toolsUsados > 0` ya existía escrita, apagada
detrás de `DOER_GROQ_TOOLS` y en una rama mutuamente excluyente con la que corre. Igual
no habría atajado nada: ese día el modelo **sí** llamó una tool (`ver_plan` — es la fila
de `out:6` del registro de gasto, el tamaño de un tool_call sin argumentos) y redactó
igual en el paso siguiente. La pregunta correcta no es «¿llamó alguna herramienta?» sino
**«¿ocurrió el efecto que esta ruta exigía?»**, y de eso hay prueba dura: `linkBorrador`,
que solo se setea cuando `crearPropuesta` hizo el INSERT.

**Cómo leer el registro de gasto para esto** (es lo que resolvió el caso): `recordUsage`
corre **una vez por PASO** del loop de tools, no por llamada. Dos filas del mismo minuto
con la misma feature son dos pasos de la misma conversación. Y `rutearDoer` es una
heurística de regex, síncrona y sin LLM: **nunca** emite una fila. Un día con la tool
llamada trae una fila extra de la feature del borrador; el día roto, no.

**La regla que queda:** un agente con herramientas necesita que el código verifique **el
efecto**, no la intención. Si la ruta exige una acción y la acción no ocurrió, la prosa
del modelo no es una respuesta: o se reintenta con otro proveedor, o se manda un «no
pude» honesto. Nunca el payload. Vive en `lib/respuesta-doer.ts`, sin `server-only` para
poder testearla, con el mensaje real del 9/8 como caso 1.

⚠️ **Y el log estaba invertido respecto del riesgo:** los dos `console.warn` del link
vivían DENTRO de `if (respuesta && linkBorrador)`, así que el caso leve (puso el link mal)
logueaba y el caso grave (no hubo borrador) era el único mudo. Por eso del 9/8 no quedó
una sola línea en Vercel y el bug solo se supo porque el dueño lo pegó en el chat.

**Vive en:** lib/respuesta-doer.ts, lib/mako-doer-in.ts (el loop de rotación y la compuerta antes de `enviarAGrupoJid`), lib/detalle-contrato.ts (`MOLDE_ADVERTENCIA`), tests/respuesta-doer.test.ts · *2026-08-09 doer-borrador-roto*

### ⚠️ Los pasos de acción de un flujo son afordancia viva con dispatcher muerto

`crear_tarea` / `inscribir_nutricion` / `marcar_lead` existen como `AccionFlujo`
(lib/flujos-tipos.ts:34), se eligen HOY desde un dropdown de la UI
(app/agencia/FlujoEditor.tsx) y `lib/flujos.ts:75` encola un pendiente con
`tipo: \`flujo_${paso.accion}\`` (más `flujo_wa_lead` en la línea 62). Pero `ejecutarAccion`
solo tiene los casos `lead_etapa`, `nutricion_toggle`, `meta_nombre|presupuesto|estado` y
`tareas_plan`: **ningún `flujo_*` matchea**. El dueño confirma por WhatsApp y recibe «❌ No se
pudo: Acción desconocida: flujo_crear_tarea». La cañería proponer→confirmar-por-WhatsApp→
ejecutar ya está construida y probada; falta un `case`, no una arquitectura.

**Vive en:** lib/flujos.ts:62 y :75 vs el switch de `ejecutarAccion` en
lib/mako-doer-acciones.ts:100-170 · *2026-07-16 perro-guardian-captura*

### ⚠️ Pendiente: no hay tool que escriba las fechas, la asistencia ni los Deal Details

No existe tool para `fechaJ1`, `asistenciaR1/R2`, `calificado`, `fathom*` ni los `deal*`.
Mientras no exista, mover a una etapa de reunión o de cierre desde WhatsApp se registra con
`{ omitir }`: pasa, pero declarando qué quedó sin cargar. **Si se agrega la tool, sumar el
`StepId` a `REQUISITOS_PEDIBLES` en el mismo commit** — si no, el canal sabe cargarlo y sigue
sin pedirlo.

**Vive en:** lib/mako-doer-acciones.ts (input_schema de las 11 tools)

### ⚠️ Pendiente: `faltantesParaMover` decide con `hoyEnTijuana()` fijo

Acá no es una cohorte persistida sino **gating**: decide si una reunión «ya pasó» y por lo
tanto si se exige asistencia/Fathom. Para un workspace en Madrid el borde del día está ~9 h
corrido, y eso hoy **bloquea o destraba a MaKo** un día antes o después. Ver
[hallazgos-infra.md](hallazgos-infra.md) §2.

**Vive en:** lib/leads.ts:1570

### ⚠️ Pendiente: «Hola MaKo» no funciona y no recuerda la conversación

Reporte del dueño sin cerrar: «Hola MaKo» no funciona, los audios por WhatsApp tampoco, MaKo
no guarda los mensajes anteriores ni el histórico de la conversación, y sospecha que no
consulta de verdad los datos del dashboard. *(2026-07-15)*

**Vive en:** lib/mako-doer-in.ts · lib/mako-doer-acciones.ts

### Un validador hereda las capacidades del canal donde lo ponés

**Síntoma:** el dueño escribe «mové a Juan a Agendado» por WhatsApp. MaKo contesta «falta
cargar la Fecha de la Reunión 1, pedí ese dato». El dueño la dice. MaKo vuelve a contestar lo
mismo. Para siempre.

**Causa:** se cerró un agujero real —MaKo movía a Ganado sin monto— exigiendo **todos** los
requisitos del wizard del CRM. Pero las 11 tools del doer solo saben escribir `monto` y
`motivo`. La fecha de una reunión, la asistencia, el link de Fathom y los Deal Details viven
en Calendly/Fathom/la ficha, y **ninguna tool los carga**. El error hasta le mentía al modelo:
le decía «pedí ese dato» y no había dónde ponerlo.

**El diagnóstico obvio era el equivocado:** el bug no estaba en la validación (que es correcta
y sigue) sino en **de dónde se copió**. El wizard del CRM puede exigir la fecha de la R1
porque la carga en el mismo paso; WhatsApp no.

**Regla:** antes de exigir un dato, preguntá **por dónde se carga ese dato desde acá**. Si no
hay camino, no es una validación: es un callejón sin salida, y el usuario no tiene forma de
saber que está en uno. Se **pide** lo que el canal sabe cargar; lo que no puede cargar **no
bloquea pero tampoco se calla**: se mueve con `{ omitir }`, que deja en `lead_audit` qué quedó
sin cargar y por qué, y viaja en el resumen que el dueño lee antes de decir que sí.

**Vive en:** `REQUISITOS_PEDIBLES` + `veredictoRequisitos()` en lib/mako-doer-acciones.ts ·
*2026-08 validación de movimientos de etapa*

### Una acción diferida sobrevive al deploy que le cambia las reglas

Corolario del anterior, y se pasa por alto siempre: las `mako_pendientes` creadas **antes** de
la validación nueva se ejecutan **después**. Con la primera versión, el dueño apretaba «sí»
sobre una propuesta que él mismo había pedido y le rebotaba.

**Regla:** todo cambio en la validación de una acción diferida tiene que contestar **qué pasa
con las que ya están en la cola**. La cola es estado viejo corriendo con código nuevo.

**Vive en:** lib/mako-pendientes.ts · lib/mako-doer-acciones.ts

### Se valida al proponer *y* al ejecutar, y no es duplicación

- **Al proponer** (`proponer_cambio_etapa`): para que MaKo pida el monto o el motivo **en la
  misma respuesta**, en vez de proponer algo que rebota después del «sí».
- **Al ejecutar** (`ejecutarAccion`): porque entre la propuesta y el «sí» **pasan horas** y el
  dato pudo cargarse o borrarse en el medio.

Los dos caminos llaman al mismo `veredictoRequisitos()`; lo que no puede pasar es que
contesten distinto. Sin poder leer el lead se manda `'validar'`, así `setPipelineStage` **falla
cerrado** en vez de mover a ciegas.

**Vive en:** lib/mako-doer-acciones.ts

### La confirmación del doer no cruzaba turnos: el modelo proponía y confirmaba solo

El mecanismo «MaKo propone, el dueño confirma» existía en la prosa del preámbulo, no en el
código. `proponer_*` y `confirmar_accion` viven en el MISMO loop de tool-use (maxSteps 8): el
paso 0 creaba la pendiente en la base y el paso 1 la leía con `pendientesVigentes` y la
ejecutaba, sin ninguna guarda de edad mínima ni de turno distinto. Lo que el TTL y el scope por
`grupo_jid` sí garantizaban era que un «sí» viejo o de otra charla no dispare nada — pero no
que hubiera un humano. Importa porque el doer ingiere contenido inyectable (notas de leads,
historial de WhatsApp, PDFs e imágenes que entran como bloques nativos) en el mismo loop que
tiene `meta_presupuesto`, que es gasto real de la cuenta.

**Regla:** toda tool de confirmación tiene que rechazar la pendiente creada en el turno actual.
Hoy el guard compara `createdAt` contra el `turnStart` con 1,5 s de margen.

**Vive en:** lib/mako-doer-acciones.ts (case 'confirmar_accion') · lib/mako-pendientes.ts ·
lib/anthropic.ts (`chatClaudeTools`) · *2026-07-19 ~review-tareas-de-whatsapp-al-plan*

### ⚠️ A un modelo rápido no lo atás con más prompt: el candado va en la tool

El fix que intentó atar al modelo desde adentro del resultado de la tool **falló en
producción** tres horas después del deploy: MaKo volvió a anunciar «3 preguntas» sobre un
borrador que tenía cero. El único patrón de ese archivo que demostró atar al modelo es devolver
`{ok:false, error:'…'}` desde la tool y dejar que reintente (el candado `pareceConfirmacion`),
con tope de un reintento para no colgar el turno. **Dónde NO ponerlo:** en el preámbulo del
doer — ya está ahí y ya se ignora.

**Vive en:** lib/mako-doer-acciones.ts:438 (el molde que sí ata) y :467 · *2026-08-06
contexto-de-todas-las-tareas*

### El botón sin motivo dejaba el motivo de la pérdida anterior

`lib/mako-confirmaciones.ts`, rama `op:<key>`: «Marcar Perdido» no trae motivo, así que la
salida se registraba con el motivo de una pérdida **anterior** o sin ninguno. Es la misma
herencia que se arregló del lado del validador (ver [hallazgos-crm.md](hallazgos-crm.md) §3,
«El motivo de pérdida se heredaba»), un nivel más arriba: el validador ya distingue «motivo de
ESTE movimiento», pero solo sirve si el caller **manda uno**. Hoy siempre lleva el del `op` y,
si no hay, uno armado con la regla y el título de la confirmación.

**Regla:** cuando el validador aprende a distinguir un dato nuevo, revisá **quién lo manda**.
Un caller que no lo manda pasa la validación con el dato viejo.

**Vive en:** lib/mako-confirmaciones.ts

### La hora que MaKo repite es display

`lib/mako-tools.ts:243` formateaba la hora de la R1/R2 en `America/Tijuana` — o sea, un cliente
en otro huso escuchaba a MaKo decirle la hora **del dueño**. Es display puro y se migró a
`tzActual()`, resuelto **una vez por listado, no por fila**.

**Regla:** lo que la IA le dice al cliente es UI. Todo lo que pasa por un `toLocaleString` en
`lib/mako-*` se trata igual que una card.

**Vive en:** lib/mako-tools.ts:243

### Regla: si MaKo puede resolverlo, lo resuelve; y toda acción irreversible se previsualiza

«Si lo puede hacer MaKo, siempre debería, solo me debe preguntar en caso de NO encontrar
respuesta» *(2026-07-19)*. Pero antes de ejecutar: modal de confirmación que **previsualiza
exactamente lo que va a pasar** — «antes me confirmes que hay un modal de "confirmación" en
donde pueda previsualizar todas las tareas que le está por mandar a evaluar con el perro.
Porque de lo contrario, se van a crear muchas tareas que pueden estar mal» *(2026-07-17)*.

### Regla: todo lo que toca la IA queda en el historial, firmado por MaKo

«No actualizaste el HISTORIAL de cambios en cada tarea o proyecto… Eso es muy grave… Eso tiene
que ser regla siempre» *(2026-07-17)*. Sin excepción y sin demora, con el actor que lo hizo
(MaKo vs Claude Code) y su motivo. Si lo hizo la IA, firma **MaKo con ícono de IA**, no con
foto de usuario ni «vos» *(2026-07-14)*.

---

## Gasto y saldo

### ⚠️ Un precio guardado en código parte el mes en dos monedas, y una «optimización» aparece sola

**Síntoma:** el gasto diario de agosto cae de US$5,63 (8/8) a US$0,87 (9/8). Parece una mejora de
6× y se festeja el arreglo.

**Causa:** el commit `14912639` (9/8 11:25) bajó `claude-sonnet-5` de `{in:3, out:15}` a
`{in:2, out:10}` en `lib/anthropic-usage.ts:50` — su propio mensaje lo dice: «todo el histórico
medido queda sobrevaluado 50%». Y `cost_usd` es una columna **congelada al insertar**
(`recordUsage` llama a `costFor` y guarda el número, `:112,:115`; `getUsageSummary` devuelve lo
almacenado tal cual, `:261`). O sea: las filas del 1 al 8 están tarifadas a 3/15 y las del 9 al 13
a 2/10 **para el mismo modelo**. La caída real fue de 3,8×, no de 5,8×, y **~US$16 de los US$65 de
agosto son contabilidad, no plata**. La prueba aritmética: las 5 filas de `out=32.000` dan
62.896×3 + 32.000×15 = US$0,6687 exacto — solo cierra a 3/15.

**Regla:** antes de festejar (o de diagnosticar) una caída de gasto, `git log -S` sobre la tabla de
precios. Toda comparación que cruce la fecha de un cambio de precio compara **unidades**, no
comportamiento. Y si el precio va a cambiar otra vez con fecha conocida (sonnet-5 vuelve a 3/15 el
2026-09-01, verificado), el histórico ya escrito queda en otra moneda **para siempre**: o se guarda
la versión del precio junto a la fila, o se documenta qué baseline cuelga de ahí — hoy cuelga el de
`/admin/dev/pricing`.

**Vive en:** lib/anthropic-usage.ts:50 (tabla), :112-115 (congelado), :261 · *2026-08-13 optimizar-gasto-ia-mako*

### ⚠️ El panel de gasto por workspace NO puede decir la verdad sobre Claude

**Síntoma:** «el 99,9% del gasto de IA es del workspace del dueño; los clientes casi no consumen».
Se planifica el pricing sobre esa premisa.

**Causa:** `wsDeProveedor` (`lib/anthropic-usage.ts:22-25`) manda **toda** llamada con
`provider='anthropic'` a `OWNER_WS` **a propósito**, porque va contra la key compartida de la
agencia; el resto (gemini/openai/groq) es BYOK y sí se registra en el workspace del request.
Cruzando los US$14,35 de `closing` de agosto contra el workspace **dueño de cada análisis** (tabla
`closing_analyses`, no `anthropic_usage`): ws9 US$9,24 · ws1 US$2,24 · ws11 US$1,87 · ws3 US$1,00.
**El 84% del gasto de closing ya era trabajo de clientes.**

**Regla:** cuando el costo se atribuye por **proveedor** y no por consumidor, ninguna cifra «por
workspace» de ese proveedor sirve para decidir pricing. Para saber a quién le costó hay que cruzar
contra la tabla del dominio. Si eso importa para el negocio, el registro necesita **dos** campos:
quién **paga** (la key) y para quién se **trabajó**.

**Vive en:** lib/anthropic-usage.ts:22-25 · cruce contra closing_analyses · *2026-08-13 optimizar-gasto-ia-mako*

### ⚠️ El 77% de lo que se le pagó a Opus fue para que dijera «esto no es una venta»

**Síntoma:** `closing` es el análisis insignia y su costo parece proporcional al valor entregado.

**Causa:** `lib/closing.ts:156-157` hace `if (externals.length > 0) return null` con el comentario
«Claude decide venta/servicio»: cualquier reunión con **un** invitado externo entra a Opus con el
transcript completo (60.000 chars, `:305` y `:359`). De las 74 llamadas de agosto, **57 (77%)
terminaron en `descartada`** — weeklies, mentorías, juntas de equipo, coaching de 60 a 125 minutos.
US$9,56 de los US$14,35.

**Y los dos umbrales deterministas obvios FALLAN, medidos contra los datos:** «el lead ya tiene
`fecha_cierre` anterior» caza 2 de 57 (55 de esas reuniones no tienen lead en el CRM), y «sin lead
en el CRM no se analiza» se lleva puestas **7 de las 17 ventas reales**.

**Regla:** antes de mandarle a un modelo caro un input caro, preguntá cuánto de ese input termina
en «no aplica». Si es más de la mitad, el filtro va **antes** y va **gratis** — y no como umbral
determinista sino como **clasificador barato sobre los metadatos** (título + resumen +
participantes), porque los umbrales obvios se prueban contra los datos y fallan. ⚠️ El modo de falla
es caro y silencioso: una venta mal clasificada **nunca se analiza y no aparece en ninguna
pantalla**. Va con la fila en `status='error'` (reintentable, `:741`), midiendo el clasificador
contra el histórico **antes** de encenderlo, y con la regla «ante la duda, VENTA».

**Vive en:** lib/closing.ts:156-157 · :305 · :359 · :571-595 · *2026-08-13 optimizar-gasto-ia-mako*

### ⚠️ El cron por workspace tiene un techo silencioso de DOS clientes

**Síntoma:** con clientes conectados, la factura de `closing` no sube. Se lee como «los clientes
casi no consumen».

**Causa:** `app/api/cron/closing-sync/route.ts:15` declara `maxDuration = 300`.
`lib/cron-workspaces.ts:48-57` recorre los workspaces **secuencialmente**, sin presupuesto propio y
**sin rotación** (el orden lo da `listarWorkspaces()`). Y cada `syncClosingCalls()` reserva
`DEFAULT_TIME_BUDGET_MS = 150_000` para sí mismo (`lib/closing.ts:716`). 150 + 150 = 300:
**alcanzan DOS workspaces por corrida, y siempre los mismos dos.** Del tercero en adelante nadie
recibe análisis y no hay ningún aviso — el resultado del cron es un array de `{ws, ok}` que solo
incluye a los que corrieron.

**Por qué importa más que el ahorro:** con 10 clientes la factura NO sube, pero 8 no reciben el
servicio. **El costo está capado por un bug, no por una decisión**, y el síntoma es que el producto
no se entrega.

**Regla:** un cron que itera N workspaces adentro de un `maxDuration` reparte el presupuesto
(`maxDuration ÷ workspaces conectados`) o se queda en los primeros, y el orden **rota** con un
cursor persistido para que la inanición no caiga siempre sobre los mismos. Y el resultado declara
cuántos quedaron **sin correr**: un contador que no distingue «no había» de «no llegué» es la misma
trampa que una API que devuelve vacío en vez de error.

**Vive en:** app/api/cron/closing-sync/route.ts:15 · lib/cron-workspaces.ts:48-57 · lib/closing.ts:716 · *2026-08-13 optimizar-gasto-ia-mako*

### GOTCHA: la «fuga» del Perro no era un 429 — el override apuntaba a Sonnet

**Síntoma:** `mako-guardian` tiene override a `gemini-flash-latest` y sin embargo 144 de sus 331
llamadas corrieron en `claude-sonnet-5` y costaron US$10,81. **El diagnóstico obvio** —N llamadas
en paralelo contra una key dan 429 y la cascada degrada— **era el equivocado**, y llevaba a tocar
la cascada, que no tenía nada que ver.

**Causa:** de las 147 llamadas pagas, **120 (US$9,60 = 89%) no tienen nota de fallback**. El commit
`a6bc9b44` (5/8 10:05) lo dice textual: «el override que estaba guardado en /modelos-ia lo pineaba
a claude-sonnet-5 y ganaba». El override **no apuntaba a Gemini: apuntaba a Sonnet**, igual que el
`def`. El 429 explica solo US$1,22. El minuto exacto está en los datos: el 5/8 a las 12:51:58 la
fila «Probe: rutear con Gemini» corrió en `claude-sonnet-5` y a las 12:53:20 la **misma** prueba
corrió en `gemini-flash-latest`.

**Regla:** toda auditoría de gasto de IA lee `app_settings['mako.modelos']` del ws1, **no** el
catálogo: el modelo que corre de verdad es `override ?? def`, y **el override es global para todos
los workspaces** (tocar un modelo «para probar» cambia el de todos los clientes). Corolario
temporal: un hallazgo sin fecha se lee contra el código de hoy — el diagnóstico del 9/8 concluía «el
Perro no tenía nada que ver», cierto al escribirlo (el arreglo había entrado 4 días antes) y falso
para la ventana que estaba analizando.

**Vive en:** app_settings key `mako.modelos` (ws1) · lib/model-catalogo.ts · *2026-08-13 optimizar-gasto-ia-mako*

### GOTCHA: un output en un número redondo es un CORTE, y subir el tope lo encarece

**Síntoma:** las 5 llamadas más caras del mes tienen output **exactamente 32.000**. Huele a
`maxTokens` tocando techo y el arreglo obvio es subirlo.

**Causa, en dos capas.** El techo existe (`lib/mako-guardian.ts:738`) y sí trunca: el JSON llega
mocho, `parseJsonObject` falla en `:740` y `:744` devuelve `{proyectos:[], tareas:[]}` — **se paga
el máximo Y la salida sale cortada**. Pero lo caro es otra cosa: **cuatro de esas cinco llamadas
son idénticas** (in=62.896, out=32.000, «Re-priorización del plan») y corrieron a las 01:53, 01:54,
01:56 y 01:57 del 2/8. El mismo trabajo cuatro veces en cuatro minutos: US$2,68 por un job que
valía US$0,67.

**Y el arreglo histórico ya había sido el equivocado:** el comentario de `:733-737` documenta «13
corridas seguidas pagadas (US$2,74) sin una sola prioridad aplicada» con el techo viejo de 8.000, y
la respuesta fue **subirlo a 32.000** — multiplicar por 4 el costo de cada corte en vez de trocear.
El corte volvió igual, a US$0,669 en vez de US$0,219. El patrón es grande: de 297 llamadas pagas de
`mako-guardian` + `checklist-coach` en julio+agosto, **58 terminaron con el output exactamente en
su tope = US$9,31 de US$18,79 (el 50%)**.

**Regla:** un output que cae en un valor redondo y exacto es un corte, no un resultado. **Si el JSON
no entra, se PARTE el lote** — subir el tope solo encarece el corte. Y el corte tiene que ser un
**hecho en la fila** (propagar `stop_reason`), no un `console.warn`: hoy «se cortó por tope» y
«devolvió JSON inválido» caen en el mismo `fallo: true`, y la primera se reintenta partiendo el
chunk mientras la segunda no.

⚠️ **Y el molde que uno copiaría no existe:** `puntuarNuevas` **no trocea nada**. Solo dimensiona el
techo (`topeSalidaPerro = Math.min(24000, 6000 + n*400)`, `lib/mako-guardian.ts:948`) y con n ≥ 45
satura y trunca igual; su red es el reintento de `:991-998`, no el troceo. Escalar un techo con el
tamaño del lote **no es trocear**: solo mueve el punto donde se rompe, y el `Math.min` marca el n
exacto a partir del cual vuelve el bug.

**Vive en:** lib/mako-guardian.ts:738-744 · :733-737 (el comentario) · :948 · *2026-08-13 optimizar-gasto-ia-mako*

### El prompt caching acá es un error de redondeo: US$0,27 al mes

**Síntoma:** `cache_creation_tokens` y `cache_read_tokens` suman **cero** contra 16,4 millones de
tokens de input. Parece la palanca obvia y grande. **No lo es**, y se midió antes de invertir.

**Causa, en orden de peso:** (1) de los 16,4M de input, solo ~6,85M pasaron por Claude — el resto
corre en proveedores gratis, donde cachear no ahorra un peso; (2) la feature más cara,
`plan-fathom`, gastó el **71% en OUTPUT** (in 3,41M / out 1,67M) y el caching solo toca el input;
(3) la única input-dominada, `closing`, tiene un input **único** por llamada (el transcript): lo
único estable es `SYSTEM_ANALISIS`, 3.942 caracteres ≈ 1.100 tokens contra 29.820 de input medio =
**3,7%**.

**Regla:** antes de invertir en caching, partí el costo en **input** y **output** y descontá lo que
corre en proveedores gratis. El caching solo toca input **pago y repetido**. Dos trampas si igual se
hace: el mínimo cacheable de opus-4-8 y sonnet-5 son **1.024 tokens** y por debajo cachea cero **en
silencio**; y la escritura con TTL de 1 h cuesta **2× el input**, no 1,25× como asume
`lib/anthropic-usage.ts:79` — deployarlo sin tocar esa línea deja el gasto registrado 37% por
debajo del real.

**Vive en:** lib/anthropic.ts:135 (`system` como string plano, 54 call-sites) · lib/anthropic-usage.ts:79 · *2026-08-13 optimizar-gasto-ia-mako*

### Transcribir NO cuesta nada: lo caro es analizar (y la confusión desvía toda la optimización)

**Síntoma:** «se consume muchísimo en transcribir reuniones, ¿no hay forma de que sea más
barato?». Con esa premisa se busca abaratar el transcriptor — que no existe.

**Causa:** Fathom graba, transcribe y **entrega el texto ya hecho**; MaKo solo lo descarga
(`lib/fathom-api.ts:173-176` — es un GET, no hay modelo en el medio). Medido sobre toda la
historia del sistema, transcribir costó **US$0,0018**. Lo que cuesta es **leer ese texto**:
en agosto, sacar las tareas de cada reunión US$23,44, analizar llamadas de venta US$14,35,
priorizar el plan US$7,21. **Analizar salió ~13.000 veces más caro que transcribir.**

**Regla:** antes de optimizar «lo que cuesta X», mirá qué renglón de la tabla de gastos
lleva ese nombre. Acá el nombre de la feature (`plan-fathom`) se confunde con el proveedor
del transcript, y el que paga es el modelo que lo lee.

**Y el número unitario, que es el que tranquiliza:** una reunión larga se trocea en ~8
partes de 25.000 chars; una pasada completa cuesta **US$1,50**. Los US$19 de una sola
reunión salieron de **repetirla 13 veces** (una por hora), no de que leerla sea caro.

**Vive en:** lib/fathom-api.ts:173-176 · lib/plan-fathom.ts (CHUNK_CHARS=25000) · *2026-08-13 railway-y-transcripcion*

### El 69% de lo que paga `closing` son juntas de ENTREGA, y el resultado se tira

**Síntoma:** se planifica Customer Success como un costo NUEVO («vamos a transcribir y
analizar todas las reuniones con clientes, ¿cuánto va a salir?»).

**Causa:** ya se está pagando. `lib/closing.ts:156-157` manda a Opus cualquier reunión con
un invitado externo, y **51 de las 74 llamadas pagas de agosto (US$9,89) eran juntas de
entrega con clientes** — el modelo las lee enteras, las clasifica como «no es una venta» y
**se descarta el análisis**. Histórico: 177 de 283.

**Regla:** antes de presupuestar una feature nueva sobre un input, fijate si ese input ya
está pasando por un modelo pago y se está tirando. El costo marginal de Customer Success no
es analizar esas reuniones — es **guardar lo que ya se analiza**. La cartera completa (13
clientes, ~30 juntas/mes) sale entre **US$0 y US$6/mes**.

⚠️ **El único escenario caro es un error de configuración:** si la feature de CS nace con un
`def` pago en `lib/model-catalogo.ts`, se repite la historia de los US$23 en cuatro días
multiplicada por 13 clientes. Darla de alta en GRATIS **antes** de escribirla es lo que
activa la red del test de `model-registry`.

**Palanca sin usar:** el **Batch API** de Anthropic cobra la mitad en trabajo asincrónico
que nadie está esperando — que es exactamente el cron nocturno de closing. −50% sin cambiar
de modelo ni tocar el prompt.

**Vive en:** lib/closing.ts:156-157 · lib/model-catalogo.ts:129 (el pagoPorque de closing) · app/cs-analyst (todavía «próximamente») · *2026-08-13 railway-y-transcripcion*

### GOTCHA: un subagente afirmó un precio «verificado» que era falso, y era el más caro de creer

**Síntoma:** un agente devolvió, con la fórmula «verificado hoy en fathom.ai/pricing», que la
API pública de Fathom **solo existe del plan Team (US$19/usuario, mínimo 2) para arriba** y
que bajar a gratuito dejaría a MaKo sin leer reuniones. Eso invalidaba una recomendación de
US$18/mes ya entregada al dueño.

**Causa:** era falso. La misma página, leída de nuevo, lista **«Public API & MCP»**
disponible en **Free, Premium, Team y Business**. El agente citó la URL correcta y concluyó
lo contrario de lo que dice.

**Regla:** cuando un subagente contradice una afirmación **que ya se le entregó al dueño**,
la verificación no se delega: se abre la fuente y se lee. Un agente que cita una URL no
prueba que la leyó bien — y el costo de equivocarse acá era romperle la lectura de reuniones
al producto para ahorrar US$18. Corolario del repo, ya escrito para los revendedores de
modelos: **el precio de un proveedor no es un dato hasta que lo verificás vos**.

*2026-08-13 railway-y-transcripcion*

### Google bloquea las keys «Standard» de Gemini en septiembre — ✅ MaKo ya está migrado

> ✅ **VERIFICADO EL 2026-08-14: no hay nada que hacer.** Las **9** keys de Gemini cargadas
> (ws1, ws3, ws9 ×3, ws10, ws11 ×3) empiezan con **`AQ.A…` y miden 53 caracteres**, que es el
> formato **auth**. Las Standard son `AIza…` de 39. Se leyó el prefijo de cada una
> descifrándolas y mirando solo los primeros 4 caracteres.
>
> Se deja escrito igual porque **la trampa sigue viva para lo que venga**: cualquier key de
> Gemini que alguien cargue de un backup viejo, de un `.env` de otro proyecto o de una cuenta
> creada antes de 2026 puede ser Standard, y **muere en septiembre sin aviso**. El chequeo es
> mirar el prefijo.

**Qué es esto, en una línea:** Google no cambió el precio ni pide rotar nada — cambió el
**tipo de credencial** por seguridad. La Standard identifica un *proyecto* y no un llamador,
así que no admite control de acceso; la auth queda atada a una service account. **Sigue siendo
un string en un header, sin OAuth y sin tocar código**: se genera una key nueva en AI Studio
(las nuevas ya nacen auth) y se pega.

**Esto no es un hallazgo de costo: es una fecha de corte del servicio.** Verificado el
2026-08-13 en la doc oficial (https://ai.google.dev/gemini-api/docs/api-key), textual:

> «On September 2026: the Gemini API will reject requests from **Standard keys**. You must
> migrate to auth keys before this date to avoid service interruption.»
> «The Gemini API rejects requests from **unrestricted** standard keys. Standard API keys
> that have explicit restrictions applied continue to work.»
> «Starting May 7, 2026, the Gemini API blocks unrestricted API keys that have been dormant
> for an extended period.» (quedan con el cartel «Blocked» en AI Studio)

**Por qué importa acá y no en cualquier repo:** Gemini es el proveedor que sostiene **casi
toda la IA gratis de MaKo** — `plan-fathom`, `mako-guardian` y `checklist-coach` corren ahí
con `fallback: []`, o sea que **fallan en vez de comprar Claude**. El día que las keys dejen
de andar, el síntoma no va a ser una factura alta: va a ser que **las reuniones no dejan
tareas**, en todos los workspaces a la vez.

**Lo verificado hoy, que es la buena noticia:** la key del ws1 responde **HTTP 200**, así
que hoy funciona — o tiene restricciones aplicadas, o ya es auth key. Y **las keys nuevas
creadas en AI Studio ya nacen auth**, así que cargar cuentas nuevas ahora suma cuota sin
comprar el problema.

**Regla:** antes de apoyar una feature en el free tier de un proveedor, **buscá su página de
deprecaciones**, no solo la de precios. Un free tier no se rompe subiendo el precio: se rompe
cambiando el formato de la credencial, y eso no aparece en ninguna comparativa de costos.

**Cómo se chequea sin entrar a AI Studio** (y sin exponer el secreto): el **prefijo** lo dice
todo — `AQ.A…` de 53 caracteres es auth, `AIza…` de 39 es Standard. Se descifra la fila y se
miran los primeros 4 caracteres. Si un día las llamadas gratis empiezan a fallar en masa con
**400/403 «API key not valid»** —y no con 429— es esto y no la cuota.

**Cómo se distingue en 10 segundos** (los dos casos hoy caen en el mismo `console.warn` de
`lib/ai-cheap.ts`, así que hay que preguntarle al proveedor):

```sh
curl -s -o /dev/null -w '%{http_code}\n' \
  -X POST 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions' \
  -H "Authorization: Bearer $GEMINI_API_KEY" -H 'Content-Type: application/json' \
  -d '{"model":"gemini-flash-latest","messages":[{"role":"user","content":"ping"}],"max_tokens":5}'
```
**429** → es cuota, se resuelve con más cuentas. **400/403** → la key está bloqueada, y sumar
cuentas no arregla nada.

**Vive en:** las filas `GEMINI_API_KEY*` de `credenciales` · lib/ai-cheap.ts (la cascada) · lib/model-catalogo.ts (los `fallback: []`) · *2026-08-13 cuentas-ia-sin-limite*

### El tope de cuentas por proveedor ES la whitelist: no se puede volver «sin límite»

**Síntoma:** el pedido razonable «sacá el límite de 3 cuentas, que no tenga tope» parece un
cambio de una constante.

**Causa:** `MAX_KEYS` no es un tope de producto, es un **tope de nombres**, y de él cuelga la
lista de claves que el API acepta guardar: `MAX_KEYS` → `clavesDe` → `CLAVES_EXTRA` →
`ENVS_METODO` → los guards de guardar / borrar / revelar. Reemplazar esa lista por un patrón
(`/_API_KEY(_\d+)?$/`) para que sea infinita **abre un agujero grave**: `guardarCredencial`
termina en `process.env[clave] = valor` cuando el workspace es el dueño, y `cfgDe()` de
`lib/ai-cheap.ts` relee `process.env.CHEAP_BASE_URL` en **cada** llamada. Una clave de más
aceptada es **todo el tráfico de IA de todos los inquilinos saliendo hacia otro host con los
Bearer adentro**.

**Regla:** cuando una constante sostiene una whitelist, «sacar el límite» no es cambiarla por
infinito: es cambiar una lista por un parser, y ese parser pasa a ser el borde de seguridad de
la app. Subir el número (3 → 10) es gratis y seguro; sacarlo no. Y al usuario se le dice
**«son 10»**, no «no tiene límite» — 10 cubre 3× el consumo medido y subirlo es una línea.

**El corolario que se paga aparte:** subir el tope multiplica las lecturas. `provsDe` y
`cuentasDe` resolvían las cuentas con un `credWs` **por slot**: 3 SELECT pasaban a 10 por
proveedor (hasta 50 por generación y otros 50 por pintada del gauge), casi todos para
descubrir que la key no existe. Por eso nace `lib/ia-keys-ws.ts`: una query por workspace,
cacheada con `cache()` de React (**dedupe por request**) y nunca con `unstable_cache`, que es
cross-request — cachear qué credenciales tiene cada inquilino es una fuga esperando a pasar.

**Vive en:** lib/ia-keys.ts (MAX_KEYS y el comentario que explica por qué no se saca) · lib/ia-keys-ws.ts · lib/ai-cheap.ts (provsDe) · lib/ia-cuotas.ts (cuentasDe) · *2026-08-13 cuentas-ia-sin-limite*

### Ningún proveedor de IA dice de qué cuenta es una API key

**Síntoma:** con varias cuentas del mismo proveedor cargadas, no hay forma de saber cuál es
cuál. La idea obvia es autocompletar el email preguntándole al proveedor.

**Causa: no se puede, y son cinco de cinco.** Verificado el 2026-08-13:

| Proveedor | ¿Devuelve el email? |
|---|---|
| **Gemini** | **NO**, y está escrito: *«Standard keys don't identify a caller»*. La key cuelga de un **proyecto** de Google Cloud, no de una persona |
| **OpenRouter** | **NO.** `GET /api/v1/key` devuelve `label`, `creator_user_id`, `limit`, `usage`, `rate_limit` — ningún campo de email (`creator_user_id` es un id) |
| **Groq** | No documenta endpoint de cuenta; además las keys son de la **organización** |
| **Cerebras / Mistral** | Sin endpoint de cuenta documentado |

**Regla:** una API key identifica un **proyecto o una organización**, casi nunca a una
persona — así que «de quién es esta key» es un dato que solo tiene el que la pegó. Se pide una
vez y se muestra siempre; prometer un autocompletado que no existe es peor que pedirlo.

⚠️ **Y el gotcha que lo habría dejado inservible:** el form de /integraciones pinta
`••••{mask}` en cuanto la credencial está guardada **sin mirar `c.secreto`**. Un email
guardado se veía **`••••.com`** — lo contrario de para lo que existe. Todo campo no secreto
que se guarde por este camino necesita que `estadoCampo` devuelva el valor entero **y** que el
form lo pinte completo: son dos lugares, y el DTO copia props a mano entre ellos.

**Vive en:** lib/ia-keys.ts (SUFIJO_CUENTA) · lib/metodo-catalogo.ts (cuentaDe) · lib/credenciales.ts (estadoCampo) · app/integraciones/ServicioConfigForm.tsx · *2026-08-13 cuentas-ia-sin-limite*

### ⚠️ Nada en `lib/` corta una llamada por gasto: `ia-cuotas` reordena, nunca bloquea

**Síntoma:** se asume que el sistema de cuotas ya frena algo. No frena nada.

**Causa:** `ordenarPorCuota` (`lib/ia-cuotas.ts:86-93`) devuelve
`[...no-agotados, ...agotados]` — la misma cantidad de proveedores que entró. El comentario
lo dice: «Nunca los saca: solo los manda al final». No hay en todo `lib/` una sola rama que
devuelva error por dinero gastado. Lo único que frena algo son presupuestos **por corrida**
(`closing.ts:704`, `ads-analyst.ts:502`): topean una invocación del cron, no a un cliente —
nada impide que corra de nuevo mañana. `saldo-ia-bajo` avisa, no corta; `lib/rate-limit.ts`
es en memoria por instancia y muere en el cold start.

**Regla:** un límite por plan hay que escribirlo entero, y el chequeo tiene que ser
**pre-flight**. Los `recordUsage` existentes son posteriores a la llamada y fire-and-forget:
sirven para contabilizar, no para gatear.

**Vive en:** lib/ia-cuotas.ts:86-93 · lib/closing.ts:704 · lib/ads-analyst.ts:502 ·
*2026-08-08 analisis-costos-ia-cobros*

### ⚠️ Tres módulos gastan sin registrar, y siempre contra la key de la agencia

**Síntoma:** el gasto medido en `anthropic_usage` no cierra con la factura de OpenAI.

**Causa:** `lib/embeddings.ts:27` (un `text-embedding-3-small` por **cada búsqueda del
RAG**, vía `mako-knowledge.ts:190`), `lib/transcribe.ts` (whisper-1 ×2, gpt-4o-mini y
gpt-4o visión en `:132,:174,:203,:260`) y `app/api/ads-manager/analyze-creatives/route.ts:44`
(gpt-4o, hasta 8 imágenes, **sin guard de rol**) llaman a la API sin pasar por
`lib/anthropic.ts` ni `lib/ai-cheap.ts`. `grep -c 'recordUsage\|recordSttUsage'` da **0** en
los tres. Además resuelven la key con `envCred` —que siempre cae a `OWNER_WS`— en vez de
`credWs`, así que **un cliente BYOK igual se lo paga la agencia**.

**Regla:** cualquier número de gasto sacado de `anthropic_usage` es un **piso**, no un
total. Al taparlo, whisper va con `recordSttUsage` (cobra por segundo, y `verbose_json` ya
devuelve `duration`), el resto con `recordUsage`.

**Vive en:** lib/embeddings.ts:24,27 · lib/transcribe.ts:54-63,132,174,203,260 ·
app/api/ads-manager/analyze-creatives/route.ts:30,44 · *2026-08-08 analisis-costos-ia-cobros*

### ⚠️ Un chequeo de conexión que usa OTRO resolver que la ruta caliente pinta verde y te cobra a vos

**Síntoma:** el cliente carga su API key, `/integraciones` la pinta conectada, y la factura
la sigue pagando la agencia. Ninguna pantalla puede mostrar la contradicción.

**Causa:** son **dos resolvers distintos para el mismo servicio**. «Probar conexión»
(`lib/metodo-verificar.ts:12`, importa `credWs`) resuelve con la key **del cliente** — y por
eso da verde. El trabajo real sale por `envCred` (`lib/embeddings.ts:24`,
`lib/transcribe.ts:58`), que **siempre** cae al workspace 1. El chequeo prueba un camino y
la app usa otro.

**Regla:** un chequeo de conexión llama **al mismo resolver** que la ruta caliente. Si no
puede, no es un chequeo: es una decoración. Es el mismo antipatrón que el pin de
`plan-seed-ia` documentado en `lib/model-catalogo.ts` («se elegiría un modelo acá y seguiría
corriendo otro»), y la misma familia que el Google Calendar que se pintaba conectado con un
token que no alcanzaba para escribir.

⚠️ Y hay un segundo orden: como el gasto de Claude se anota siempre en ws1
(`lib/anthropic-usage.ts:22-25`), **te auto-facturás a precio de lista plata que pagó otro**.

**Vive en:** lib/metodo-verificar.ts:12,382 · lib/credenciales.ts (`credWs` vs `envCred`) ·
lib/embeddings.ts:24 · lib/transcribe.ts:58 · *2026-08-09 pricing-paso-3*

### ⚠️ «El texto dejó de costar» es, en parte, «el texto dejó de medirse»

**Síntoma:** los workspaces de clientes figuran gastando casi cero y suena a buena noticia.

**Medido el 09/08/2026** sobre `anthropic_usage` (todo el histórico, leído paginado):

| Workspace | Costo | Llamadas | Tokens |
|---|---|---|---|
| 1 (agencia) | US$95,70 | 1.255 | 16,1M |
| 3, 9, 10, 11 (clientes) | **US$0,04** | **1.005** | **7,5M** |

Mil llamadas y siete millones y medio de tokens registrados en cuatro centavos. **No es que
sean baratos: es que no se miden.** `costFor` (`lib/anthropic-usage.ts:70`) devuelve 0
`if (provider && PROVEEDORES_GRATIS.includes(provider))` — **por estar en una lista**, no
porque el tier real de esa key sea gratis. El día que un free tier se agote o que la
plataforma sirva su propia key, ese renglón aparece de golpe y nadie lo tenía en la
proyección.

**Regla:** un costo de cero tiene que poder distinguir «no cobró» de «no lo miramos». Si el
0 sale de una lista y no de una medición, la fila necesita decirlo.

**Vive en:** lib/anthropic-usage.ts:68-73 (`costFor`, `PROVEEDORES_GRATIS`), :117 (el mismo
patrón en STT) · *2026-08-09 pricing-paso-3*

### ⚠️ El ruteo barato «ya decidido» no existe en el código

El análisis de precios (`app/admin/dev/pricing/modelo.ts` → `RUTEO`) proyecta sobre
gpt-5.6-luna, Qwen3.7-Flash, Kimi K2.6 y GLM-4.7-Flash. **Ninguno de los cuatro aparece en
una línea ejecutable.** Lo que corre hoy (`lib/ai-cheap.ts:35-61`) es Groq
`openai/gpt-oss-20b`, Gemini `gemini-flash-latest`, Cerebras `llama-3.3-70b`, Mistral
`mistral-small-latest`, OpenRouter `meta-llama/llama-3.3-70b-instruct:free` y OpenAI
`gpt-4o-mini`.

O sea que el «436× más barato extraer una reunión», las «4 acciones que caen a cero» y el
margen del 96% del Pro **son proyecciones sobre una configuración que todavía no existe**.
No están mal: están sin implementar, que es distinto — y la diferencia importa cuando el
número se usa para fijar un precio.

Los defaults viven en env (`CHEAP_MODEL`, `GEMINI_MODEL`, `CEREBRAS_MODEL`…), así que mover
tres de los cuatro es configuración, no código. El que no entra por ahí es el de contexto
gigante para reuniones, que es justamente el del 436×.

**Vive en:** lib/ai-cheap.ts:35-61 · app/admin/dev/pricing/modelo.ts (`RUTEO`, `RERUTEO`) ·
*2026-08-09 pricing-paso-3*

### ⚠️ Los 1.000 contactos declaraban 8,5 altas y sus tasas dan 5,95

`BASE_PROPIA` nació con `altasMes1: 5.95, altasMes2: 2.55, altasTotal: 8.5` y con
`cierran: 0.035`. La cadena declarada —1.000 × 20% × 3,5% × 85%— da **5,95**. Los 8,5 son
la misma cadena con 5% de cierre: dos corridas conviviendo en una línea, y el 2,55 era
doble conteo que llegó a la pantalla del dueño como titular («8,5 altas de los 1.000»).

Lo que lo hizo invisible es una coincidencia numérica: 8,5 × 0,7 = 5,95, exactamente el
resultado de la cadena buena. Así que el mes 1 «cerraba» contra la cuenta correcta y nadie
miraba el total. Y el archivo ya se contradecía en dos lugares —`Pricing.tsx:825` pinta la
MISMA cadena diciendo 5,95, y `losQueFaltan.viaBase` dice «duplicar de 3,5% a 7% son +5,95
altas»—, pero las dos secciones no se leen juntas nunca.

**Regla:** un número derivado no se escribe a mano al lado de sus insumos. Si conviven en
la misma constante, el test que multiplica los insumos y compara contra el derivado es lo
único que impide que se separen — el compilador ve dos `number` y calla. Vale para toda
cadena de embudo del modelo, no solo para esta.

**Y el diagnóstico obvio era el equivocado:** el plan afirmaba que `BASE_PROPIA` no existía
y había que crearla («los 1.000 contactos se perdieron»). Existía desde `6db4210`, entera y
con mejores fuentes que las que el plan proponía (`respondenFuente`/`cierranFuente`/
`aprobacionFuente`, una por tasa, en vez de un `fuente` único). Lo que faltaba no era el
dato: eran tres campos del modelo de dos monedas. Antes de reponer algo «perdido», grepear
el nombre.

**Pendiente:** si el mes 2 era una SEGUNDA pasada sobre los que no contestaron, es otra
cadena con su propia tasa y hay que declararla aparte; hoy quedó en `altasMes2: 0`.

**Vive en:** app/admin/dev/pricing/modelo.ts (`BASE_PROPIA`) · app/admin/dev/pricing/Pricing.tsx:825,995-1005 ·
tests/pricing-modelo.test.ts (`las altas de los 1.000 contactos salen de sus propias tasas`) ·
*2026-08-10 cac-dos-monedas*

### ⚠️ La conclusión escrita a mano no se entera de que el dato de al lado cambió

**Síntoma:** la parte 3 del documento de pricing abría diciendo «solo un canal entra»
mientras la tabla de la misma pantalla, doscientos píxeles más abajo, pintaba tres.

**Causa:** la prosa se escribió cuando `cacUsd` sumaba plata y horas. Al partir el CAC en
dos monedas **el veredicto se dio vuelta** —entran tres de cinco, y los dos más baratos en
plata son justo los que se pagan con horas— y no había nada que relacionara la frase con
`CAC_CANALES`. Es el mismo patrón del doble conteo de los 1.000 contactos un escalón más
arriba: allá era un NÚMERO derivado escrito a mano, acá un VEREDICTO escrito a mano.

**Regla:** un conteo que aparece en prosa se guarda con un test que lo derive del dato y
exija que esté escrito. El test arma la frase esperada desde `CAC_CANALES` («tres de los
cinco canales») y falla mostrando el texto viejo. Dos detalles que lo hacen servir:

- **El conteo va en letras.** `includes('3')` pasaría por accidente: el «0,03%» de la misma
  frase ya trae un 3. `includes('tres de los cinco canales')` no.
- **El límite también se verifica** (`105,84`), formateado como lo pinta la pantalla. Es el
  ancla contra la que se miden los canales; si cambia, la frase entera hay que reescribirla.

**Y la trampa de al lado:** al agregar la conclusión de la parte, quedó diciendo lo mismo
que la `frase` del `Titular` de su primera sección, palabra por palabra y a sesenta píxeles.
Cuando dos capas resumen lo mismo, la de arriba se queda con el veredicto y la de abajo
cuenta lo que sigue. Los porcentajes se siguen derivando de `CAC_CANALES` en la que se
pinta: la prosa solo repite el ancla que el test verifica.

**Pendiente:** las 26 h del orgánico (`CAC_CANALES.organico.horas`) siguen heredadas del
modelo roto (US$2.601,60 ÷ US$100/h) y esperan una pregunta al dueño. Ninguna conclusión se
apoya en ese número, a propósito.

**Vive en:** app/admin/dev/pricing/modelo.ts (`INDICE`, `Pregunta.conclusion`) ·
app/admin/dev/pricing/Pricing.tsx (`Parte`) · tests/pricing-modelo.test.ts (`la conclusión
de la parte 3 no puede contradecir a CAC_CANALES`) · *2026-08-10 cac-dos-monedas*

### ⚠️ El registro de la IA barata es `void` sin `await`, y el insert nunca lee su `error`

**Síntoma:** faltan filas de consumo y no hay ningún log que lo explique.

**Causa:** dos agujeros distintos. (1) Los 6 registros de `lib/ai-cheap.ts`
(`:184,:359,:385,:467,:523,:560`) se disparan con `void` y no se esperan — en serverless la
instancia se puede congelar con el INSERT en vuelo. `lib/anthropic.ts:125,:256` sí awaitea,
así que el camino de Claude es el confiable y el barato el frágil. (2) `insertUsage`
(`lib/anthropic-usage.ts:76-87`) envuelve todo en try/catch con `console.warn` y **nunca lee
el `{ error }` que devuelve supabase-js**: como `.insert()` no lanza ante errores de base, un
rechazo de RLS (habilitada en la mig. 0118) o una violación de constraint se pierden **sin
ningún log**. El catch solo cubre lo que sí se tira (falta la service key, red, timeout).

**Regla:** antes de construir cuotas sobre esta tabla, el registro tiene que ser
verificable: leer el `error` del insert, envolver los 6 call-sites en `after()` de
`next/server` (patrón que el repo ya usa en `app/api/plan-fathom/route.ts:11`), y que un
fallo de **lectura** sea un error explícito y no un cero — hoy `getUsageSummary` deja
`rows = []` y `usoHoyProveedores` hace lo mismo, que es el sentido más caro del error.

**Vive en:** lib/ai-cheap.ts:184,359,385,467,523,560 · lib/anthropic-usage.ts:76-87,225-237 ·
lib/ia-cuotas.ts:47-61 · *2026-08-08 analisis-costos-ia-cobros*

### ⚠️ `cost_usd` no es una medición: es una tabla hardcodeada con dos sesgos

`PRICING` (`lib/anthropic-usage.ts:39-52`) lista 12 modelos y `DEFAULT_PRICE` es **precio de
Opus** (5/25): un modelo que no esté en la tabla se sobrefactura — ya pasó con
`claude-sonnet-5` (lo documenta el comentario de `:44`) y hoy le pasa a `gpt-4o`, que no está
(solo `gpt-4o-mini`). Y al revés: `costFor` devuelve 0 para groq/gemini/cerebras/mistral/
openrouter **por estar en una lista**, no por el tier real; el costo verdadero se recomputa
solo **al leer**, solo para Gemini y solo si hay saldo cargado (`:245-256`).

**Regla:** si los «MaKo Tokens» se derivan de `cost_usd`, heredan las dos distorsiones.

**Vive en:** lib/anthropic-usage.ts:39-74,245-256 · *2026-08-08 analisis-costos-ia-cobros*

### ⚠️ El resumen de gasto y el gauge de cuota cortan en 1000 filas, y «hoy» se define dos veces

**Síntoma:** ninguno a la vista. Con uso suficiente, el gasto sale corto y el restante del
saldo, largo. No hay aviso.

**Causa:** `getUsageSummary` pide `.limit(20000)` (lib/anthropic-usage.ts:297), que no levanta
el techo de 1000 filas de PostgREST (lo explica lib/supabase-paginado.ts). Ordena por
`created_at` descendente, así que se queda con las 1000 más NUEVAS y lo que pierde es el
principio de la ventana. Y la ventana arranca en la carga de saldo más vieja (`:272-273`), que
puede tener meses: lo primero que se cae es justo el gasto «desde que cargaste». Es un piso, no
un total. `usoHoyPorCuenta` tiene el mismo `.limit(20000)`, y sin orden (lib/ia-cuotas.ts:126):
un workspace con más de 1000 llamadas en el día ve la cuota más libre de lo que está.

Aparte, la ventana del día: `usoHoyPorCuenta` corta a medianoche de la hora del SERVIDOR
(`setHours(0,0,0,0)`, lib/ia-cuotas.ts:117) y `getUsageSummary` en UTC (`setUTCHours`,
lib/anthropic-usage.ts:269). En producción coinciden porque el runtime corre en UTC (el repo no
fija `TZ`); en local o en un script con otra zona, dos pantallas que dicen «hoy» cortan en
horas distintas.

**Regla:** «un número redondo es una hipótesis de truncamiento» (AGENTS.md): una suma sobre
`anthropic_usage` se pagina o no es un total. Y «hoy» se define en un solo lugar. La API de
MaKo avisa el corte en `ver_gasto_ia` (lib/api-mako/areas/integraciones.run.ts:216); la lib y
`/api/anthropic-usage`, no.

**Estado al 17/09/2026:** las dos lecturas paginan (`leerTodo` en `getUsageSummary`,
`leerPorPaginas` en `usoHoyPorCuenta`), con el cliente crudo y el `eq(workspace_id)` explícito
conservado. Ya estaba mordiendo: `app/admin/dev/ai-spend-cuotas/bitacora.ts` anotaba «agosto ya
tenía 997 filas contra el techo», y el reemplazo paginado (`lib/costos-ia.ts`) existía mientras
`getUsageSummary` seguía vivo y sin paginar. El aviso de la API (`integraciones.run.ts`) se
corrigió en el mismo cambio.

**Sigue sin hacer:** (1) las dos leen con `getSupabaseServer()` en vez de `getTenantDb()`,
contra la regla de la casa; pasarlas cambia el comportamiento del fallback de workspace, por eso
quedó afuera. (2) Un error de lectura en `getUsageSummary` ahora se loguea, pero la pantalla
sigue mostrando el gasto como si fuera cero. (3) «Hoy» sigue definido dos veces.

**Vive en:** lib/anthropic-usage.ts:267-298 · lib/ia-cuotas.ts:116-126 ·
*2026-09-16 api-mako-areas*

### ⚠️ El saldo y el gasto de IA son globales a ws1 aunque la key sea BYOK por workspace

**Síntoma:** Mauricio (ws1) ve el saldo de Gemini y el historial de cargas que hizo Martín
desde ws9, en una tarjeta que a la vez dice «Por configurar».

**Causa:** el sospechoso obvio —la credencial de Gemini— está bien: `credWs('GEMINI_API_KEY')`
sí resuelve por workspace. La falla es la **contabilidad**: `getSaldo`/`setSaldo`/`agregarCarga`
usan el cliente crudo y clavan `.eq('workspace_id', OWNER_WS)` con una key que lleva el
proveedor pero no el workspace (existe UNA sola fila `saldo.gemini` en todo el sistema), y
`getUsageSummary` lee `anthropic_usage` sin filtro de workspace aunque esa tabla SÍ esté en
`TENANT_TABLES` — el archivo saltea `getTenantDb` a propósito, con comentario. Es el mundo
pre-BYOK: «una agencia, un pool de keys, dueño = ws1».

**Regla:** cuando una key pasa a ser por-cliente, su LIBRO (saldo, uso, cuotas) migra con ella.
Anthropic puede seguir global mientras sea la única prepaga de la agencia, así que el scoping
es **por proveedor**, no ciego.

**⚠️ Actualización 16/09/2026: lo de Gemini quedó arreglado; lo de Claude, no, y muerde en las
TRES direcciones.** Hoy `wsDeProveedor` (lib/anthropic-usage.ts:28-39) manda al workspace del
request todo lo que no es `anthropic`, y `getUsageSummary` filtra por ese workspace (`:294`).
Para Claude, en cambio, devuelve el ws del cliente solo si `credWs('ANTHROPIC_API_KEY', ws)` da
algo; si no, `OWNER_WS`, que es Mauricio, un cliente.

- **Lectura.** `getSaldo('anthropic')` (`:204-207`) lee el `anthropic_saldo` del ws1, y
  `getUsageSummary` (`:263-264`) se lo devuelve al cliente como `saldo` y `restanteUsd` (saldo
  del ws1 menos cero, porque el cliente no tiene filas de Claude). `/api/anthropic-usage` se lo
  sirve a cualquier admin de workspace, y `SaldoMaKo` lo pinta en el menú de perfil. La API de
  MaKo lo anula en `ver_gasto_ia` salvo `ws === OWNER_WS` o key propia
  (lib/api-mako/areas/integraciones.run.ts:188,197); la lib y la ruta siguen con la fuga.
- **Registro.** `insertUsage` (`:104-111`) usa la misma función. El comentario de `:25-26`
  («sin key propia `chatClaude` ni siquiera puede correr») es cierto para lo que COBRA: sin key
  del cliente, `credWs` da null y `chatClaude` tira antes del `fetch` (lib/anthropic.ts:170-171,
  :336-337). Lo que sí se registra es la fila del veto: `registrarBloqueo` (lib/anthropic.ts:50-54)
  corre ANTES de pedir la key (`:164`, `:330`) con `provider` por default `'anthropic'`, así que
  el bloqueo de un cliente sin key cae en el ws1, con su motivo. Los dos diagnósticos de la
  corrida tenían razón. Y el cliente ve Claude en 0 USD y 0 tokens, cuando lo honesto es null.
- **Escritura.** `setSaldo` (`:227-237`) y `agregarCarga` (`:243-259`) escriben con
  `wsDeProveedor`: un admin de un cliente sin key de Claude que carga o corrige saldo pisa el
  `anthropic_saldo` del ws1. La ruta lo facilita: `POST /api/anthropic-usage` convierte en
  `'anthropic'` cualquier `provider` que no sea anthropic/openai/gemini, o ninguno
  (app/api/anthropic-usage/route.ts:55). Por eso la API de MaKo no ofrece cargar ni corregir
  saldo.

**Regla (16/09):** la pregunta no es «qué proveedor» sino «de quién es la key». Para un
workspace sin key propia, el gasto de Claude es null y el saldo no se lee ni se escribe.
**Sin hacer:** esa condición, en positivo, en `getSaldo`, `setSaldo`, `agregarCarga` e
`insertUsage`, y en la ruta, que además tiene que validar `provider` en vez de coercerlo.

**Vive en:** lib/anthropic-usage.ts:65-73, :135-188, :205-213 · lib/ia-cuotas.ts:44-48 ·
app/integraciones/IntegracionesBoard.tsx:934,1011 · *2026-07-23 trace-gemini-leak-ws* ·
lib/anthropic-usage.ts:28-39, :104-111, :204-259 · lib/anthropic.ts:50-54, :164, :330 ·
app/api/anthropic-usage/route.ts:55 · *2026-09-16 api-mako-areas*

### ⚠️ `costFor()` registra a costo cero todo lo que esté en PROVEEDORES_GRATIS

Devuelve 0 para gemini/groq/cerebras/mistral/openrouter **por estar en la lista**, no por el
tier real: esas llamadas se anotan gratis aunque el tier sea pago. Es el mismo módulo que
ignora el override de modelo (ver [Modelos y ruteo](#modelos-y-ruteo)).

**Vive en:** lib/anthropic-usage.ts:68 · *2026-08-05 cierre-ronda-mako*

### ⚠️ Pendiente: los números del saldo no cierran

Reportes del dueño sin cerrar, todos del mismo mes:

- El saldo de **Claude** aparece mal: **$-0.14** después de cargar 20 USD. *(2026-07-22)*
- El costo de **Gemini** se calcula mal: el dashboard de Gemini dice **$9.85** y MaKo dice otra
  cosa; y el historial marca como **pagos** tokens que fueron gratuitos, de antes de la fecha
  de carga de créditos. *(2026-07-22)*
- El saldo de **Groq** no se mide en dólares sino en cuántos tokens faltan para el límite.
  *(2026-07-15)*

**Vive en:** lib/anthropic-usage.ts · lib/ia-cuotas.ts · app/integraciones (Saldo de IA)

### ⚠️ Pendiente: mostrar lo que se gastó, en idioma humano

- Pop-up con los **tokens consumidos al final de cada operación**, con la descripción real de
  en qué se gastó: hoy dice cosas como «mako-doer-in». *(2026-07-15)*
- «Tokens restantes» al lado de cada funcionalidad que usa la API de Anthropic. *(2026-06-29)*

### Decisión: cada consumo deja toast e historial en Integraciones > Saldo de IA

Toast de 5 segundos por consumo, e historial dentro de Integraciones > Saldo de IA con **qué
IA y qué modelo** lo consumió, en lenguaje que entienda el cliente. «También debería
aparecerme que IA y que modelo consumió esos tokens»; el saldo **no va en la sidebar**, va a
Integraciones. *(2026-07-15)*

### Decisión: antes de una migración inicial grande, avisar que los tokens gratis no alcanzan

Se agregan las IA gratuitas con rotación y fallback, pero antes de la migración inicial se le
avisa al usuario y se le ofrece comprar la IA de mejor precio-calidad o un plan escalonado por
días: «normalmente esto va a pasar en el inicio de los clientes, cuando tengan que migrar
tooodos los datos» *(2026-07-22)*.

### Decisión: la repriorización del Perro no corre sobre todo cada 24hs

Solo si se detecta un cambio importante. Y toda operación que consuma tokens muestra cuánto
consumió. «No se si vale la pena repriorizar absolutamente todo cada 24 hs» *(2026-07-13)*.

### Regla: no gastar la API paga cuando el trabajo lo puede hacer Claude Code desde el repo

Curar contenido, auditar tareas, correr ensayos: «NO gastes creditos de CLAUDE en el ensayo,
saldrá carísimo, no tiene sentido» *(2026-08-02)*. Y del lado del desarrollo: agrupar los
cambios para que los pruebe todos juntos, no de a uno — «prefiero que hagas ahora el 7. Así lo
pruebo todo junto y no gasto tokens al pedo» *(2026-07-22)*.

---

## Cómo pregunta y responde MaKo

### ⚠️ Aplicar la gramática de MaKo no es trabajo de componentes: los datos no existen

Barrido de 42 lugares donde hoy la interfaz muestra que MaKo hizo, está haciendo o va a hacer
algo (7 superficies, 16 agentes, ninguno descartado al verificar). El reparto: `recomienda` 8 ·
`analizando` 6 · `aprobacion` 6 · `sin_conclusion` 5 · `completo` 5 · `explica` 4 · `detecto` 3 ·
`ejecuta` 3.

**El diagnóstico obvio era el equivocado.** Parecía que aplicar `<Mako>` (los nueve estados de
`lib/mako-gramatica.ts`) era cambiar el markup pantalla por pantalla. No: en casi todos los
casos **el campo que el estado exige no está en el tipo**, así que primero hay que producirlo.

Los cuatro patrones, con el dato duro:

- **`recomienda`: en los 8 lugares faltan CUATRO de los cinco campos.** Existe la acción y a lo
  sumo una razón; no existen impacto esperado, esfuerzo, responsable ni objetivo. Los tipos:
  `Sugerido = {texto, razon?}`, `Alerta = {nivel,titulo,detalle,href,hrefLabel,desglose}`,
  `Reco = {prioridad,titulo,detalle}`, `recomendaciones: string[]`, `Pattern`, `AvisoCatalogo`.
  Es literalmente el «consejo genérico» que el producto dice no dar.
- **`analizando`: ninguno tiene progreso real.** Todos son un booleano (`loading`, `pending`,
  `syncing`) con animación indefinida — lo que el documento prohíbe explícitamente. Ni la fuente
  de datos se declara.
- **`ejecuta`: ninguno de los 3 persiste.** Vive en `useState`; un F5 y no queda forma de saber
  si lo que pediste pasó.
- **`completo`: ninguno de los 5 tiene próximo control.**

**Y cuatro cosas que no son gaps sino bugs:**

- `app/plan/board/MakoProyecto.tsx:19` — si la llamada falla, **el error se traga y la UI pasa
  igual a `result`**: el usuario ve el nombre que ya tenía, firmado «propuesto por MaKo». Un
  fallo disfrazado de recomendación. `fase` solo admite `'generando' | 'result'`: no hay estado
  de error.
- `app/_components/MakoChat.tsx:202` — todo lo que no es respuesta se pinta **error rojo**,
  incluido «no puedo concluir». La gramática dice que ése NO es un error: un error se reintenta,
  esto se arregla conectando algo.
- `app/ads-manager/NuevaCampanaModal.tsx:682` — los pasos del loader **fingen**: los rota un
  `setInterval` de 1700 ms y se clava en el último mientras el trabajo real sigue. Progreso
  inventado es peor que ninguno.
- `lib/reportes.ts:52` — `catch` vacío, sin variable: el motivo del fallo **no existe en los
  datos**, así que no se puede mostrar aunque se quiera.

**Regla: antes de aplicar un contrato de presentación, verificá que el dato exista.** Un estado
que exige cinco campos sobre un tipo que tiene uno no se resuelve en la vista — se resuelve
agregando los campos donde se producen, y recién después se pinta.

**Vive en:** lib/mako-gramatica.ts · app/plan/board/MakoChecklist.tsx · app/general/page.tsx · app/crm/lead-view/GeneratedInsightCard.tsx · app/_components/MakoChat.tsx · app/ads-manager/NuevaCampanaModal.tsx · lib/avisos-catalogo.ts · *2026-08-08 corrida de 16 agentes*

### Regla: la IA FACILITA — sugiere, completa, y si pregunta, pregunta CERRADO

«Se volvió super complejo crear un guion, me pide muchas preguntas abiertas, esa NO es la
idea… La idea es que la IA facilite» *(2026-07-31)*. Todo lo que se puede deducir se completa
solo. Si hace falta preguntar, la pregunta es **cerrada**, en cualquier lugar de la app. Nunca
preguntas abiertas.

### Regla: las preguntas son personalizadas, con formatos variados y una opción libre al final

«Todas multiple choise, cuando se podría aprovechar otros formatos de preguntas… Checklist, u
ordenar, o darle una puntuación» *(2026-07-22)*. El **tipo** se elige con criterio: «Mal la
primera pregunta, en lugar de multiple choise, debería haber sido multiple select»
*(2026-07-23)*. Y son **dinámicas**: la respuesta previa genera las preguntas siguientes —
«dependiendo de una respuesta previa, se pueden generar preguntas posteriores… Eso enriquece
el contexto que le doy al perro» *(2026-07-22)*. Nunca 3 preguntas genéricas de multiple
choice.

### ⚠️ Las preguntas dinámicas tienen que USAR el contexto ya subido

**Sigue reportado como roto.** «En avatares no pueden ser más genericas e inutiles las
preguntas que me hace… Mira que para eso le subimos antes los documentos y tiene ya info, para
poder hacerme preguntas bien puntuales, personalizadas y dinamicas… Corrigelo, hazlo bien»
*(2026-07-30)*. Si ya cargó documentos y la IA pregunta genérico, está mal hecho.

Dos síntomas más del mismo lote, también abiertos: con **1 de 4** respondidas ya genera los
avatares; y en «Tu entregable tangible», al responder «Si lo tengo claro», MaKo **no
repregunta** de qué es ni pide subirlo. El dueño ya avisó que van muchas vueltas y pidió
multiagentes si hace falta.

**Vive en:** lib/onboarding.ts (`generarPreguntasCerradas`) · lib/avatares.ts ·
lib/entregable.ts · app/onboarding

### ⚠️ El resumen del archivero falla y trae solo 2 apartados

«Eso no puede fallar» *(2026-07-30)*. Reportado y sin cerrar; el segundo apartado además sale
incompleto — mirá primero el `validar` de la cascada, que acepta salidas vacías (ver
[La capa barata](#la-capa-barata)).

**Vive en:** lib/onboarding.ts · El Archivero

### Regla: acento argentino solo al ASESORAR; lo que se produce para el cliente va en español plano

«Esta bien que MaKo tenga el acento Argentino al asesorar, pero no al crear cosas para el
cliente, como guiones o textos que van en los anuncios». «Cambia todos los textos a español
plano, no argentino. No pongas "¿Tenés algún otro documento para sumar?"». «No utilices acento
argentino, a veces no se te entiende… A que te referís conque los tableros "banquen"».
*(2026-06-30)*

### Regla: nada de jerga interna ni tecnicismos en lo que ve el cliente

«No quiero que tenga lenguaje complejo o que haga referencia a cosas internas de la app… Que
no ponga "La fabrica de creativos"». «"Vieron tus videos", nuevamente no se entiende. ¿Qué
videos? mis reels? mis ads? Sería, vieron tus anuncios». «Baja a tierra a un lenguaje simple…
no quiero tecnicismos como la matriz 3x3». *(2026-06-30)* Si el nombre no se entiende solo, se
cambia.

### Regla: el Perro Guardián no es complaciente y jamás pregunta qué prioridad poner

«El perro NO debe ser complaciente, y creo que con las preguntas que me hizo se saltó ese
filtro» *(2026-07-22)*: tiene que comparar el proyecto o la tarea nueva **contra los que ya
existen** y discutir la prioridad, no puntuar 97 porque el usuario lo pidió. Y priorizar es su
trabajo, no el del usuario: «el perro me está preguntando a mi que prioridad poner, cuando es
SU trabajo… Los clientes MIENTEN, EXAGERAN, SON EMOCIONALES, NO SABEN PRIORIZAR. Para eso
creamos el perro!» *(2026-07-22)*. Puede pedir una opinión, pero después razona y la contrasta.

### Regla: la IA vive DENTRO de la tab donde se trabaja, no en una pantalla aparte

«Una nueva tab con un nuevo chat, cuando ya existía un "Pregúntale a MaKo"» *(2026-07-10)*: no
se crea una tab ni un chat nuevo para algo que ya existe. La IA es funcionalidad de la tab, no
una pantalla.

### Regla: todo lo que se construye para el dueño se construye para los clientes, en la misma pasada

«Todo esto tiene que modificarse también para los clientes, que les aparezca lo mismo, hoy en
los clientes, sigue igual que antes» *(2026-07-12)*. «Los cambios que hacemos tienen que
impactar siempre para clientes también. Nunca razones que es solo para el dueño»
*(2026-07-22)*. Y donde la pantalla es la misma, es **la misma**: «no entiendo porque la vista
de superadmin y cliente son diferentes en la tab de Plan, deben ser lo mismo» *(2026-07-13)*.

### Decisión: el análisis de MaKo muestra su proceso en vivo y se puede auditar

«Analizando tab de X», «Analizando gráfico de Y», y un lugar para revisar cómo llegó a las
conclusiones. Sin ver el proceso no hay forma de confiar en que analizó todo a profundidad.
*(2026-07-01)*

### Decisión: todo se configura con prompts y botones

Nada de configuración manual en ninguna feature. El usuario no tiene que aprender a configurar
un software: la IA y los botones tienen que resolverlo por él. *(2026-06-30)*

---

## Analistas y fábrica de creativos

### ⚠️ El Closing Analyst tiene el equipo de Mauricio hardcodeado

Los emails y dominios que marcan una llamada como «interna» están escritos a mano en el código
(martinkoncke@gmail.com, ejemplo.colaborador.mako@gmail.com, negocio-uno.com) y no son configurables por
workspace: en cualquier otro cliente la clasificación venta-vs-interna se equivoca **en
silencio** y contamina los promedios de score. En la misma línea, el prompt de análisis está
afinado a un negocio concreto —consultoría/coaching que vende mentoría, método SPIN, entrega
4DX/OKR, voz rioplatense—: no es un analizador de ventas genérico out-of-the-box.

**Regla:** toda lista de «los nuestros» sale de la config del workspace, no del archivo.

**Vive en:** lib/closing.ts:117-121 (internos) y `SYSTEM_ANALISIS`:215 (prompt) · *2026-07-19
~landing-24-features-auditoria*

### ⚠️ Fathom ignora el filtro por `recording_id`, y los action items llegan siempre vacíos

Dos trampas de la API de Fathom en el Closing Analyst. (1) El filtro por `recording_id` lo
ignora Fathom del lado servidor (está comentado en `analyzeOne`): re-analizar UNA llamada
obliga al barrido completo paginado de toda la cuenta. (2) `syncClosingCalls` llama
`fetchAllMeetings` sin `includeActionItems` y `fetchMeetingContent` tampoco los trae, así que
el slot de action items del prompt recibe **siempre** «(ninguno)» — el tipo `FathomActionItem`
existe en la lib y no se llena nunca, y Claude concluye que no hubo compromisos en la llamada.

**Regla:** un slot de prompt que llega siempre vacío es indistinguible de un dato real vacío; o
se loguea, o no se pone.

**Vive en:** lib/closing.ts (`analyzeOne`, `syncClosingCalls`) · lib/fathom-api.ts
(`FathomActionItem`) · *2026-07-02 audit-automatizaciones-lead*

### ⚠️ La Biblioteca de objeciones del Closing sigue bloqueada: `objections[].type` nunca se agregó

En el port de la vista «Métricas» se dejó explícitamente fuera de v1 el único bloque que no era
derivable: agrupar las objeciones por tipo (`socio | pensarlo | precio | presupuesto | tiempo |
ya_intente`) para mostrar cuántas veces apareció cada una y qué porcentaje se resolvió.
Verificado: `ClosingObjection` sigue siendo `{ quote, t_seconds, handled, note }`, sin `type`.
Mientras falte ese campo tampoco se pueden computar los insights que dependen de él («lo voy a
pensar 3× y perdió las 3», «decisor faltante sin trabajar»). Para habilitarlo hay tres pasos y
uno cuesta plata: (a) agregar `type` al tipo y al schema de `SYSTEM_ANALISIS`, (b) mapearlo en
`analyzedRow`, (c) **re-analizar el histórico**. La alternativa barata —tipificar por regex
sobre `quote`— se descartó a propósito: es el modelo el que ya está leyendo la llamada.

**Vive en:** lib/closing.ts:54 (`ClosingObjection`) + schema de `SYSTEM_ANALISIS` +
`analyzedRow` · app/closing/ClosingBrowser.tsx (el bloque del panorama sin renderizar) ·
*2026-06-25 ~closing-panorama-port*

### ⚠️ Tres formas de perder trabajo escrito en la fábrica de creativos

1. `preservarIds` empareja avatares viejos con nuevos **por índice**: si se regeneran en otro
   orden, las razones no quedan huérfanas — quedan colgando del avatar equivocado, que es peor
   porque nadie lo nota.
2. «Regenerar» la matriz **borra todos los guiones ya escritos**, porque el route pisa
   `setRazones(r.razones)` con celdas nuevas que traen `guiones: []`.
3. Los routes de onboarding reconstruyen el objeto campo por campo al guardar en vez de llamar
   a la normalizadora del módulo, así que cualquier campo que no esté nombrado ahí **se borra
   en la próxima escritura**: ya está pasando con `enlace` del lead magnet, que crea el wizard
   del Chat Agent y editar desde `EntregableView` le borra.

**Regla:** guardar con la función normalizadora del módulo (hay que exportarla) y emparejar por
id, nunca por posición.

**Vive en:** app/api/onboarding/entregable/route.ts:47, avatares/route.ts:86,
razones/route.ts:146 · lib/entregable.ts:34,44-50 · *2026-08-06
~fabrica-creativos-y-ads-writer-research*

### ⚠️ No poder leer la matriz se escribe como matriz vacía

**Síntoma posible** (sale de leer el código, no se vio en producción): después de «escribir
un guion» o «elegir formato» desaparecen TODOS los anuncios planteados, con sus guiones.

**Causa:** tres eslabones que por separado parecen prudentes. `getSetting` convierte un error de
Supabase en `null` (lib/settings.ts:28-31); `getRazones` convierte `null` en `[]`
(lib/razones.ts:107-114); y `generarGuion` y `elegirAngulo` **releen la matriz después de la
llamada a la IA** —para no pisar lo que se editó mientras tanto— y escriben
`setRazones(actuales.map(…))` sin mirar si la celda sigue ahí (lib/razones.ts:531-533,
lib/angulos-formatos.ts:169-171). Si esa relectura falla, `[].map` da `[]` y se guarda la
matriz vacía. **La relectura que existe para no perder UNA edición es la que puede perderlas
TODAS.**

Las escrituras quirúrgicas (`setEstadoGuion`, `borrarGuionDeCelda`, `editarTextoGuion`) no
caen: hacen `find` de la celda sobre la misma lectura y, con `[]`, contestan «Celda no
encontrada» sin escribir. Ésa es la guarda que les falta a las dos de arriba.

**Regla:** un read-modify-write de un JSON entero relee en estricto (`getSettingEstricto`, que
tira) y aborta si lo que iba a modificar ya no está. «No pude leer» nunca es el punto de
partida de un `set`. El mismo molde está vivo en el historial del Video Generator:
[hallazgos-generativa.md](hallazgos-generativa.md) → «“No pude leer” sale como “no hay”».

**Sin hacer:** el arreglo de fondo —releer con `getSettingEstricto` dentro de `generarGuion` y
`elegirAngulo`, abortar si la celda no está, y un test con la lectura en `null`— no se aplicó
porque vive en libs compartidas. La API solo lo DETECTA después de escribir
(`verificarGuionNuevo` en lib/api-mako/areas/contenido.run.ts relee y avisa); la tab, ni eso.
Tampoco hay un `getRazonesEstricto` en lib/razones.ts: la API tiene su copia en
`contenido.helpers.ts`, con la clave `'mako.razones'` escrita a mano porque `SETTING_KEY`
(lib/razones.ts:50) no se exporta.

**Vive en:** lib/razones.ts:107-114 (`getRazones`), :531-533 (`generarGuion`) ·
lib/angulos-formatos.ts:169-171 (`elegirAngulo`) · lib/settings.ts:28-31 · *2026-09-16
api-mako-areas*

### ⚠️ El shape de la celda de la matriz está duplicado en cuatro archivos y ya divergió

`RazonCelda` no vive en un solo lugar: se repite como object-literal en la acción 'guardar' del
route de razones y como `type` local en `MatrizView`, `RazonesView` y las vistas del
ads-writer. La trampa concreta: si agregás un campo al tipo pero no lo sumás al object-literal
de la acción 'guardar', el campo **se pierde en silencio** cada vez que el usuario edita y
guarda — el server reconstruye la celda campo por campo. Verificado el 7/8/2026: ya
divergieron, `RazonesView.tsx:17` sigue sin `guiones`, `anguloImagen` ni `anguloVideo`, que
`lib/razones.ts` sí tiene.

**Regla:** al tocar el shape, actualizar los cuatro en el mismo commit; o mejor, importar el
tipo en vez de re-declararlo.

**Vive en:** lib/razones.ts:47 (`RazonCelda`) + `normalizarRazon` + `parseRazones` ·
app/api/onboarding/razones/route.ts (acción 'guardar') · app/onboarding/MatrizView.tsx:37 ·
app/onboarding/RazonesView.tsx:17 · *2026-07-28 mapear-onboarding-ajustes*

**Y pasó un escalón más abajo, en el guion** *(2026-09-16 api-mako-areas)*. `normalizarGuion`
(lib/razones.ts:56-71) reconstruye el `GuionItem` campo por campo y no copia `grabadoComo`
(lib/guion-estado.ts:72). Como toda lectura pasa por ahí, cada escritura de la matriz —desde la
tab o desde la API— lo borra de TODOS los guiones del negocio. Lo que eso rompe río abajo está
en [hallazgos-generativa.md](hallazgos-generativa.md) → «¿Este guion ya lo grabé?».

### ⚠️ El ensayo del onboarding del Chat Agent es de SOLO ESCRITURA: no alimenta nada

El propio comentario de la ruta lo llama «el trabajo más caro del onboarding», y lo que el
dueño escribe practicando contra los casos se guarda en el setting `chat_agent.ensayo`. Grep en
todo el repo: las únicas referencias son la constante, el read y el write dentro de esa misma
ruta (más el barrido de datos-mau). **Nadie más lo lee.** Las secuencias las arma
`armarSecuenciasDeAudios` desde los AUDIOS, y las respuestas del ensayo no entran ahí — o sea
que el paso existe solo para pintar los puntitos verdes de progreso. El circuito natural está a
la vista: el caso «silencio» ES la secuencia de seguimiento y el caso «precio» ES la respuesta
a la objeción de precio; con el desenlace por caso se puede además priorizar las respuestas que
cerraron bien y descartar las que enfriaron al lead.

**Vive en:** app/api/chat-agent/onboarding/ensayo/route.ts:96-139 (`KEY_ENSAYO`/`leerEnsayo`) ·
consumidor esperado: lib/secuencias-audios.ts (`armarSecuenciasDeAudios`), llamado desde
app/api/chat-agent/onboarding/resumen/route.ts · *2026-08-02 ~chat-agent-ensayo-y-secuencias*

### ⚠️ Pendiente: cada entidad analizada necesita su ruta propia

Deep link para cada llamada de ventas analizada, cada anuncio ganador, cada retro, cada
task/proyecto: hoy viven en sub-tabs y no se pueden compartir ni linkear. Pidió además mapear
todo lo que se está quedando sin ruta. *(2026-07-15)*

### ⚠️ Pendiente: editar y revisar con MaKo las valoraciones del Closing

Poder corregir las valoraciones de las llamadas, con historial de cambios y con efecto sobre el
puntaje final. *(2026-06-25)*

### Decisión: la Retro se estructura Retro → Experiments → Conclusions / Planning

Con MaKo leyendo todas las demás tabs para generar la Retro, replicando el método SIMPLE de
«Nueva campaña». El diagnóstico del dueño en ese momento: «hoy parece una app barata y mal
desarrollada» *(2026-07-01)*. El **template se diseña LLENO**, contemplando todos los casos de
uso, y el «cerebro de MaKo» elige en cada corrida qué sección y qué gráfico usar; el análisis
compara y cruza datos entre tabs y detecta lo que el cliente todavía no mide. Data suelta no
sirve: hace falta un organizador que priorice y decida qué mueve la aguja. *(2026-07-01)*

### Decisión: primero volver DOER lo que ya existe, después features nuevas

La app quedó «Thinker» y tiene que ser «Doer»: se priorizaron gráficos y análisis por sobre las
funcionalidades prácticas. En vez de muchos gráficos por tab, **mostrar la conclusión/insight**
que corre un prompt sobre toda la tab, y automatizar lo que hoy depende de que el usuario
apriete ejecutar *(2026-07-09)*. La lista concreta: Retro que da veredictos y propone
experimentos con historial, To-do unificado con Experiments, semáforo vivo, y todo accionable
desde el WhatsApp del dueño — «lo que creo que hará muy "doer" a la app»; recién cuando sienta
«que la app está viva realmente» se pasa a features nuevas *(2026-07-10)*.

### Decisión: la app arranca en modo simple, con un botón para encender el Avanzado

El modo avanzado devuelve todas las tabs y gráficos actuales. El usuario es un infoproductor
que ejecuta: «es probable que como está hoy la app, no usen el 80% de funcionalidades. NO
porque no estén buenas, sino porque es mucho» *(2026-07-09)*.

### Decisión: «Tono y personalidad» pasa a ser «Personalidad», resuelta como quiz

Preguntas cerradas con **frases y fragmentos de guion reales del usuario**, «en lugar de
descripciones vagas como Directo o Cercano». Como se usa para guiones, hay que elegir entre
frases, no entre adjetivos. *(2026-07-31)*

### Decisión: los ensayos del Chat Agent cierran el bucle y corren con el contexto real

«Es como un bucle infinito, no se cierra el bucle nunca, es un eterno en objeciones», y además
planteaba casos fuera del avatar (leads de 3.000 usd para el avatar de Mauricio). El ensayo
tiene que cerrar —positivo o negativo— y correr con el contexto real del negocio y del avatar
del cliente. *(2026-08-03)*

### Decisión: la generación de guiones se apoya en lo ya construido en Ads Analyst

Ganadores, patrones y etiquetado (avatar/ángulo/razón) de los guiones publicados en Meta por
fuera de Ads Writer: «ya tenemos construida toda la funcionalidad de Ads Analyst, y no la
estamos aprovechando» *(2026-08-06)*.

### Decisión: se agrega IDEAS a la content machine

Un input único con animación de escritura donde el dueño tira ideas sueltas, que después se
guían y se expanden hasta convertirse en guiones y varias piezas de contenido. Es lo que le
falta a MaKo: **que se sienta como IA**, al estilo Mila, donde la IA es la base y no una barra
lateral. *(2026-08-07)*

### Decisión: Telegram se saca de toda la app

«Saquemos de todos lados telegram, no lo quiero». *(2026-07-26)*

## Dónde vive cada estado de MaKo, de verdad

Mapeo de las ocho áreas de la app, hecho para contestar una pregunta del dueño: **en qué
escenarios reales se usa `<Mako>` y qué debe LINKEAR en vez de redibujar.** Todo lo de acá
está verificado con archivo:línea; lo que no se pudo verificar quedó afuera a propósito.

### ⚠️ `<Mako>` no tiene un solo call-site de producción

Lo primero que apareció, y cambia el orden de todo lo demás. Grepeado en `app/` y `lib/`:
**los únicos usos de `<Mako>` están en `app/admin/ui/Gramatica.tsx`**, que es el catálogo.

Todo lo que hoy actúa de «MaKo» en el producto son modales escritos a mano, de 200 a 1.040
líneas: `MakoConfirmGate`, `DatosSinMarcarCard`, `GeneratedInsightCard`, `HandoffsPanel`,
`EntityDetalle`, `RecosModal`, `ProblemaModal`, y el `Modal` propio de `/experimentos`
(`app/experimentos/ui.tsx:165`).

**El riesgo no es que el contrato esté mal: es escribir la fila nueva AL LADO de la pieza
vieja y quedarnos con las dos.** Cada migración tiene que nombrar qué componente reemplaza.

### La regla: si el contenido se EDITA en otra pantalla, el modal no lo dibuja

Tres tests, y manda el primero que aplica:

1. **¿El estado bloquea (`GRAMATICA[e].bloquea`)?** Hoy eso es `aprobacion`, y solo
   `aprobacion` → **el modal MUESTRA**, aunque exista pantalla propia. Su contrato pide «los
   cambios previstos, con el texto a la vista»: una aprobación que linkea es una aprobación
   que se da sin leer.
   **Corolario que decide un diseño entero: elegir `aprobacion` ES elegir redibujar.** Por eso
   el estado se elige ANTES que el link.
2. **¿Ese campo se edita en algún lado** —un `<input>`, un `<textarea>`, un paso de wizard—?
   Es grepeable: el nombre del campo + `value=`/`onChange` → **LINK**. Un modal que dibuja lo
   que otra pantalla edita queda viejo respecto de ella y nadie se entera.
3. **¿Hay una URL que seleccione esa entidad?** Si no hay ninguna, el modal es el hogar y
   dibuja lo mínimo para actuar.

**Cuando linkea, la evidencia es como máximo UNA muestra y el conteo.** Nunca la lista.

Y el link **no se escribe a mano**: sale de `lib/mako-capacidades.ts` (lista cerrada) más un
ancla — la prop `ver` de `<Mako>`. Es el mismo patrón que `haceloEn` en el board, que ya está
probado en producción.

### Los escenarios que SÍ se pueden pintar hoy

| Escenario | Estado | Linkea a |
|---|---|---|
| CRM · «Datos sin marcar» (`lib/queries.ts:2090`) | `sin_conclusion` | `/crm/<id>?solucionar=1` · `/crm?pendientes=1` |
| Chatbot · MaKo escribió una secuencia (`lib/setting-secuencias.ts:64`, nace PAUSADA) | `completo` | `/chatbot` — **falta el ancla `?sec=`** |
| WhatsApp · borrador para un lead (`lib/nutricion.ts:1023`) | `aprobacion` | no linkea: muestra el texto entero |
| Plan · repartir tareas de una reunión (`lib/reunion-destinatarios.ts:147`) | `aprobacion` | no linkea: muestra el mensaje entero |
| Plan · MaKo cerró tareas del plan de arranque (`lib/todo-seeds.ts:117`) | `completo` | `/plan?tarea=<id>` |
| CRM · marcó asistencia con Fathom (`lib/crm-auto.ts:242`) | `completo` | `/crm/<id>?tab=reuniones` |
| Ads · la cuenta de Meta no entrega (`lib/meta-health.ts:175`) | `detecto` | `/marketing/salud` |
| Ads · Meta retiene un anuncio (`lib/meta-health-ui.ts:39`) | `sin_conclusion` | externo + `/ads-manager/<adId>` |
| Closing · una llamada analizada (`lib/closing.ts:59`) | `explica` | `/closing?call=<id>` |
| Infra · la tab no tiene qué mostrar (`lib/tab-activacion.ts:59`) | `sin_conclusion` | `/integraciones` — **falta `?servicio=`** |

### ⚠️ Los estados que NO se pueden pintar, y por qué

Esto es lo que más ahorra tiempo: **el diseño de un estado no falla por el diseño, falla
porque el dato no existe.**

- **`vigila` — no se puede pintar en NINGUNA área.** Ni siquiera el ejemplo del catálogo. Para
  un lead en una secuencia, la base tiene los cuatro campos (`nutricion_inscripciones`, mig
  0034) pero **ninguna pantalla los pide**: cero apariciones en `app/crm/`, `lib/queries.ts` y
  `lib/leads.ts`. Para un experimento faltan la frecuencia y la última revisión —`medir()` corre
  on-demand en cada render (`lib/experimentos.ts:274`), no hay cron ni columna `revisado_at`—.
  Y del Perro Guardián, a quien la gramática le atribuye este estado, ningún cron persiste su
  corrida salvo `mako.cerrar-commits.ultimo`.
- **`analizando` y `ejecuta` — falta `progreso` en todas las áreas.** La Retro emite `fase` sin
  contador ni total (`lib/retro-reporte.ts:165`); importar al plan solo tiene
  `estado='procesando'`; un broadcast deja `total_destinatarios` en 0 hasta el final (mig 0046).
  **El único progreso honesto y persistido de todo el repo** es
  `analizadas / (analizadas+pendientes+sinTranscript)` de Ads Analyst (`lib/ads-analyst.ts:789`).
- **`detecto` — falta `importancia` fuera de Meta.** No existe en `plan_propuestas`, ni en
  `RetroFinding`, ni en `AdsetFatiga`, ni en los issues de anuncios. **Es una columna y es el
  arreglo más barato del mapa**: destraba el borrador de reunión de Fathom —que ya tiene la
  mejor pantalla de destino de toda la app, `/plan/revisar/<id>`— y los 14 hallazgos de la Retro.
- **`recomienda` — hoy es impintable en casi todo el producto.** De sus cinco campos faltan
  cuatro (impacto esperado, esfuerzo, responsable, objetivo).

### ⚠️ El orden correcto es: ANCLAS primero, modales después

«Linkear en vez de dibujar» degrada a «te dejo en la puerta» si el link no selecciona la
entidad. El vocabulario a copiar ya estaba escrito en `/whatsapp` (`?canal`, `?chat`, `?lead`,
`?stab`) y en `/crm` (`?pendientes=1`, `?solucionar=1`, `?tab=`).

**Hechas** (verificadas contra el build de producción, no contra `next dev`):

| Ancla | Antes | Comprobado |
|---|---|---|
| `/chatbot?stab=`<br>`/chatbot?sec=` | cero `useSearchParams` en la carpeta entera | las tres sub-tabs; el wizard abre por **id** y por **clave**; un id inexistente no abre nada |
| `/experimentos?tab=` | la tab activa era un `useState('retro')`: **todo link caía en Retro** | `experiments` y `conclusions` pintan su panel; un valor inventado cae en Retro |
| `/integraciones?servicio=` | solo leía `?gcal=` y `?ops=1` | abre el servicio y **consume el parámetro**; una key que no está en el catálogo no abre nada |

**Faltan:** `/email` (`?sec=`, `?bcast=`), `/ads-manager` por campaña y por conjunto (solo
existe `/ads-manager/<adId>`), `/ads-analyst` por guion, y las llamadas `status='pendiente'` de
`/closing`, que `getClosingViewData` filtra fuera.

**Dos cosas que se aprendieron haciéndolas, y valen para la próxima:**

- **Se acepta el id Y la clave.** MaKo arma el link desde `lib/mako-capacidades.ts`, donde
  tiene el nombre de la cosa y casi nunca su id numérico. Un ancla que solo entiende ids
  obliga a que quien escribe el link haya hecho antes una consulta.
- **Un valor que no existe no abre nada, y se dice.** Abrir el wizard con un id de otro
  workspace mostraría una secuencia vacía en vez de decir que no está: la validación va contra
  la lista real, y si no aparece se limpia el parámetro.

### El catálogo de capacidades mentía en dos filas

`lib/mako-capacidades.ts` es de donde salen los links, así que un error ahí se propaga a todo
lo que lo copie. Decía `tab: 'Chat Agent', ruta: '/chat-agent'` — la tab se llama **Chatbot**
(nav.ts:207) y `/chat-agent` es un **redirect**. Y `metricas` mandaba a `/dashboard`, que
redirige a `/marketing`. Los dos arreglados.

**Regla:** una ruta que es un redirect no es un destino. Si el catálogo la guarda, cada link
que salga de ahí rebota, y el rebote se ve como lentitud, no como error.

### Y `bloquea` se está gastando en lo reversible

`MakoConfirmGate` es un modal **no cerrable** que trata igual un `completo` con Deshacer
quirúrgico y un caso donde no pasó nada. La gramática es explícita en por qué importa: *«if you
warn people too much, they stop paying attention»*. Si no se corrige antes de migrar, el día
que llegue el envío de verdad la aprobación ya no significa nada.

**Vive en:** app/_ui/Mako.tsx (`ver`) · lib/mako-capacidades.ts · *2026-08-09 mapeo de 8 áreas*

---

## La promesa de «Uso Limitado» de Google choca con la key GRATIS de Gemini

**Vive en:** `lib/model-catalogo.ts:166` (`plan-fathom`) · `lib/plan-fathom.ts:41` ·
`lib/metodo-catalogo.ts:413` · `lib/google-calendar.ts` (`invitadosDeReunionPorFecha`) ·
`app/privacidad/page.tsx`

Apareció escribiendo la política de privacidad, que es la primera vez que alguien tuvo que
poner por escrito **a dónde va cada dato**. Un mapeo de 7 agentes lo levantó y el código lo
confirma en tres saltos:

1. `invitadosDeReunionPorFecha()` lee de Google Calendar **nombre y correo de cada
   invitado** a la reunión.
2. Esos invitados entran, literales, al prompt de `plan-fathom` — el que extrae y reparte
   las tareas de la reunión (`lib/plan-fathom.ts:62-64`: «emails de los invitados» y «TODOS
   los invitados con nombre»).
3. `plan-fathom` está ruteada a `def: GEMINI()` con `fallback: []`
   (`lib/model-catalogo.ts:166`), y corre con **la key del propio cliente**.

Y el propio catálogo de credenciales ya tenía la advertencia escrita, textual
(`lib/metodo-catalogo.ts:413`): *«El plan gratis no cobra, pero Google usa tus datos para
mejorar sus productos (con revisión humana). Para datos de clientes usa una key PAGA…: esa
NO entrena.»*

**O sea: si el cliente cargó una key gratuita de Gemini, los datos de su Google Calendar
van a un modelo que Google usa para mejorar sus productos, con revisión humana.** Eso
contradice de frente el requisito de **Uso Limitado** de la Política de Datos de Usuario de
las APIs de Google, que prohíbe usar datos obtenidos de esas APIs para entrenar o mejorar
modelos de IA de uso general — y contradice la cláusula que la política de privacidad
publicada ya afirma.

**Por qué no lo cazaba nadie:** el flag `pii` del catálogo de modelos **no gatea nada** —es
una etiqueta que se pinta en `/modelos-ia` y nada más—, y `plan-fathom` ni siquiera la
tiene. La advertencia vivía en el tutorial de una credencial, que es texto que lee una
persona al configurar, no un control. Es «una regla en un prompt no es una regla» aplicada
a una nota de ayuda.

**La regla que queda:** el día que se escribe una promesa hacia afuera —una política, un
contrato, una cláusula de uso limitado— hay que recorrer el camino REAL del dato hasta el
último proveedor. La promesa la cumple el eslabón más débil de la cadena, y acá el más débil
es una key que carga el cliente y que nosotros no elegimos.

### Lo que estaba pendiente (cerrado abajo, el 07/10/2026)

Tres salidas posibles, ninguna aplicada todavía:

- **Exigir key paga** para cualquier feature que toque datos de Google (y fallar cerrado si
  no la hay). Es lo más fiel a la promesa y lo que más fricción agrega al onboarding.
- **Rutear esas features a un proveedor con no-entrenamiento contractual**, sacándolas de la
  cascada gratis. Cuesta plata y es el criterio que ya usa `fallback: []` para otra cosa.
- **No mandar los invitados al prompt**: repartir por email es determinístico y podría salir
  del código, no del modelo. Es el que menos promete y el que más trabajo es.

Y en cualquiera de los tres, que `pii` **deje de ser una etiqueta** y pase a ser un guard
en el ruteo, o el próximo modelo que se agregue vuelve a abrir el mismo agujero.

*Corrida del 05/09/2026 — 7 agentes mapeando qué datos toca MaKo para escribir la política;
246 hechos verificados y dos auditores adversariales sobre el mapa.*

### Cerrado el 07/10/2026: la agenda no pasa por ningún modelo (y el primer arreglo era el diagnóstico equivocado)

**Vive en:** `lib/agenda-sin-ia.ts` · `lib/api-mako/areas/crm.run.ts` (las cuatro de agenda) ·
`lib/api-mako/ejecutar.ts` · `lib/api-mako/acciones.ts` · `lib/mako-doer-in.ts` ·
`app/api/mako-doer/route.ts` · `lib/auto-reuniones.ts` · `lib/plan-fathom.ts` ·
`tests/agenda-sin-ia.test.ts`

⚠️ **El diagnóstico obvio era el equivocado, y se implementó y se desplegó.** La mañana del
07/10 se eligió «IA que no entrena»: si un turno ofrecía una herramienta con datos de la
agenda, se ruteaba a Groq, OpenAI o Anthropic y nunca a una key gratis de Gemini
(`ac446f7f`). Martín lo cuestionó con una frase: *«si la IA solo procesa la info que le pide
el usuario, y la app se debe ejecutar con código interno, no con IA… limitar el uso de Gemini
en este caso no tiene sentido»*. Tenía razón, y por tres lados:

1. **La pregunta no era a QUÉ IA va el dato: era por qué va a una.** El modelo sólo necesita
   las palabras de la persona para elegir qué hacer; buscar en la agenda y mostrar el
   resultado lo puede hacer el código. Ahí la promesa de /privacidad deja de depender de
   quién es el proveedor.
2. **El ruteo dejaba abiertos los caminos que más pesaban.** Un relevo de 4 lectores midió
   que el título y la hora de la reunión llegaban igual a Gemini por el «sí»
   (`confirmar_accion` no estaba marcada), por el `resumen` de la pendiente —que se mete en
   el system de CADA turno mientras la pendiente vive (`ctxPend`) y en `listar_pendientes`,
   `ver_pendiente` y la lista `vigentes`—, por el historial del lead (`anotar()` →
   `historial_lead`) y por el título del chat de la app (`generarTitulo` sobre la respuesta
   entera). **Filtrar por herramienta ofrecida no ve un dato que viaja en un texto guardado.**
3. **Le sacaba Gemini a quien sólo tiene Gemini** (el ws13), y mandaba esos turnos a
   nuestras keys.

Cómo quedó:

- **El modelo recibe un estado de lista cerrada o un resumen armado sólo con lo que dijo la
  persona y el CRM.** Lo de la agenda va en `paraLaPersona`: `ejecutarOperacion` y
  `confirmarPendiente` lo entregan por `ctx.aPersona`, y el doer de WhatsApp lo agrega al
  final de la respuesta —después de los reemplazos y del validador— y **no lo guarda en el
  historial del grupo**, que vuelve al modelo en el turno siguiente.
- **El `resumen` de una pendiente es lo que más cuesta ver: lo lee el modelo aunque nadie
  lo haya pensado así.** Por eso no lleva el título del evento, la hora vieja ni los
  choques; esos van al detalle. El `payload` sí los lleva: lo lee sólo el código al
  confirmar.
- **Mover ya no le pide al modelo que copie el `inicio` exacto de una lista de la agenda.**
  Pasa el día y la hora que dijo la persona (`fecha_actual`, `hora_actual`) y el código
  elige (`filtrarReuniones`, ±10 min). Si hay varias o ninguna, el código se las lista a la
  persona y el modelo le pide cuál.
- **El chat de la app no ofrece esas herramientas**: guarda la respuesta entera como turno y
  con ella arma el título, y no tiene dónde separar lo que es para la persona.
- **`reuniones_lead` y el CRM automático buscan reuniones sin Google** (`conGoogle: false`,
  obligatorio en `buscarReunionesAutomatico`): lo que el motor escribe en la ficha sin que
  nadie lo mire lo leen después los análisis con IA. La pantalla (`StageMoveDialog`) sigue
  con Google: la ve una persona, que decide si guarda la fecha.
- Los invitados del calendario siguen fuera del prompt del reparto de tareas, y
  `resolverDueño` les pone el email por nombre.

⚠️ **Y una trampa que estaba de antes, destapada por un test:** `resolverDueño` aceptaba un
`dueñoEmail` vacío como email real si algún participante no tenía email — `porEmail` guarda
la clave `''`. En un Meet improvisado el rescate por nombre no corría nunca. Va `propuesto &&`.

### Lo que encontró la revisión adversarial, y cómo quedó

Cuatro lentes (fuga, corrección, cómo se porta el modelo, tests) con un refutador cada
una, sobre el árbol sin commitear. Lo que sobrevivió:

- ⚠️ **El test de la regla daba VERDE sobre la forma exacta del bug que se venía a
  arreglar.** Revisaba lo que ve el modelo buscando NOMBRES de variable (`choques`,
  `reunion`…), y la forma de HEAD era `const aviso = …choques…` + `${aviso}`: `aviso` no
  estaba en la lista. Tampoco veía `disponibles:` ni un valor partido en dos líneas. Lo que
  lo cerró fue mudar TODO el texto de las herramientas de agenda a constructores puros
  (`lib/agenda-sin-ia.ts`: `propuestaMover`, `resultadoAgendar`, `historialMover`…) y
  probarlos con CENTINELAS —títulos, horas y motivos falsos que no pueden aparecer en lo
  que lee el modelo y sí en lo que va a la persona—. Los runners quedaron obligados a no
  armar texto. **Un guard sobre datos se prueba con datos, no con nombres.**
- ⚠️ **El segundo paso de la conversación no llegaba a las herramientas.** Después de
  «tiene dos reuniones, ¿cuál?», la respuesta («la de las 16») la clasificaba
  `clasificarIntencion` como material para anotar, sin herramientas de agenda. El hueco
  existía antes, pero el diseño nuevo depende de ese ida y vuelta. Ahora la herramienta
  que deja una pregunta abierta guarda el pedido por grupo (`mako.doer.agenda.<jid>`, 30
  min, sólo con lo que mandó el modelo) y el turno siguiente es `actuar` con el CRM y una
  línea de contexto. Se cierra cuando la acción deja su pendiente.
- **Las instrucciones daban por hecho que había algo** («pídele que elija una hora») y el
  bloque del código podía decir «no tienes huecos» justo abajo: ahora son neutras. Y un
  `codigo: 'ok'` con cero horarios (el día ya pasó) decía «agenda llena» sin haberla leído.
- **«00:00 a 00:00»** para un día entero libre (el cierre daba la vuelta a medianoche), y el
  rango cerraba en «último inicio + 15» y no en el fin real del hueco.
- **La lista numerada invitaba a contestar «la 2»**, que nadie puede resolver (el modelo no
  ve la lista): ahora va en viñetas y pide el día y la hora.
- **La descripción de agendar seguía diciendo que el choque «va en el resumen»**: le
  prometía al modelo un dato que ya no le llega.
- **`horarios_libres_dia` salía por HTTP** con el libre/ocupado entero al agente del
  cliente, que también es un modelo; su descripción le decía que no lo veía. Sale de HTTP.
- **La bandeja de pendientes perdía el detalle** al confirmar (no tenía `aPersona`): ahora lo
  pega al resumen, porque ahí mira una persona.
- **El reagendar de la pantalla guardaba en el historial el motivo crudo de Google**, que
  lee `historial_lead`: ahora una frase fija por código.
- **«¿qué horarios tengo libres?»** no nombraba el área CRM y «¿tengo hueco el jueves?»
  dejaba `horarios_libres_dia` fuera del presupuesto: suman `huecos`/`libres` al área y al
  título.

Refutados con medición: lo guardado antes del cambio (el 08/10, 0 filas de `lead_audit` con
esa forma de 7.038, y 0 pendientes de agenda de 3), y un eco del bloque como mensaje del
usuario (de las 131 filas de la cola, ninguna es un mensaje de MaKo). Y uno real pero ANTERIOR,
que no es de este cambio: si el turno rota de proveedor después de que una acción dejó su
pendiente, `preparar()` vuelve a correr y queda una segunda pendiente igual (el loop del
doer no tiene la guarda de `chatCheapToolsCascade`). Resuelto el mismo día: ver «Re-arrancar el
turno repetía las ACCIONES».

### Lo que quedó sin tratar

- **La zona horaria del calendario** (`tzDelCalendarioGoogle` → `mako.timezone`) va en cada
  prompt con herramientas («HOY ES…»). Se trató como la zona del negocio, no como un dato
  de la agenda. La política promete «títulos, horarios e invitados», no la zona.
- **Una fecha que la PERSONA guardó en la ficha** desde la pantalla, prellenada desde Google,
  es un dato del CRM y la leen los análisis. No se trató.

*07/10/2026 — relevo de 4 lectores, implementación sin agentes, revisión adversarial de 4
lentes con refutador y segunda pasada. `tests/agenda-sin-ia.test.ts` probado con 23
roturas, una por vez y desde verde, todas con su fallo. Suite 4617/4617.*

## Un transcript largo se mide contra el HABLA, y el trozo final se verifica aparte (20/09/2026)

Cuatro grabaciones de Martín, 4 h 14 min, partidas en 19 trozos de 15 min y transcritas con
la cascada de siempre (Groq `whisper-large-v3-turbo` → Gemini). Martín pidió asegurar que no
quedaran **cortadas a la mitad**, que ya había pasado. Lo que se aprendió midiéndolo:

**La métrica no es caracteres por minuto de DURACIÓN, es palabras por minuto de HABLA.** Con
duración, dos trozos daban 72 y 31 pal/min contra una mediana de 133 y parecían truncados.
Descontando el silencio (`ffmpeg -af silencedetect=n=-35dB:d=1.5`) resultó que ninguno lo
estaba: uno era una conversación lenta con pausas largas y el otro la despedida, casi sin
habla. **Un umbral sobre la duración acusa de truncado a todo lo que tenga silencio**, y
mandar a re-transcribir 15 minutos de audio por eso no es gratis.

Las otras tres pruebas, en orden de costo:

1. **Continuidad con el vecino.** El trozo N-1 termina en «no no no sé cómo…» y el N arranca
   «No siento que te pueda dar un consejo…»: encadena. Es gratis y descarta el truncamiento
   de todos los trozos intermedios de una.
2. **El trozo final no tiene vecino que lo valide**, así que se le corta la cola con ffmpeg
   (`-ss dur-75`), se transcribe por separado y se busca ese texto al final del transcript.
   Si está, llegó hasta el final del audio.
3. **El mismo trozo con el otro proveedor.** Groq dio 1170 caracteres donde Gemini daba
   1175: coinciden, o sea que no es el modelo el que corta. Es la más cara y la última.

⚠️ **Whisper alucina sobre el RUIDO, no sólo sobre el silencio.** Los finales traen «Gracias.
Gracias por ver el video», puntos suspensivos repetidos y un renglón de lo que suena a una
canción de fondo. No es contenido y no hay que extraer nada de ahí — pero tampoco es una
señal de truncamiento: es lo que Whisper escribe cuando no hay qué escribir.

⚠️ **El tope de Groq para audio es por SEGUNDOS POR HORA, no por tamaño de archivo.** Con 4
horas de audio corta a la mitad de la tanda: `Rate limit reached … on seconds of audio per
hour (ASPH): Limit 7200`. Los trozos que faltaban salieron por Gemini, que acepta hasta 14 MB
inline. Un trabajo de más de 2 h de audio **necesita los dos proveedores sí o sí**, y conviene
saberlo antes de empezar: es la misma familia que «un total sólo se puede sumar si el recurso
se puede mover de lugar», con la cuota medida en segundos de audio.

**Vive en:** lib/transcribe.ts (`STT_CASCADA`, `sttGemini`) · *2026-09-20 ~accionables-mako-20sep*

---

## «Se acabó la cuota de tus 4 cuentas» era el diagnóstico de TRES bugs apilados, y la cuota estaba al 21%

**Vive en:** `lib/ai-cheap.ts` (`provsDe`, `chatCheapTools`) · `lib/fallo-ia-texto.ts` ·
`lib/mako-doer-in.ts`

El dueño, el 30/09/2026, sobre un WhatsApp de MaKo que decía «⚠️ Probé tus 4 cuentas de
IA y las 4 me rebotaron por límite»: *«¿realmente se acabó de 4 cuentas con un par de
mensajes?»*. No se había acabado nada. Medido en `anthropic_usage` para ese turno:
**Gemini contestó 8 × HTTP 200 en nueve segundos** —una fila en esa tabla **ES** un 200,
porque `recordUsage` corre después del `throw`— y el día iba 54 de 250 llamadas, el 21%.

Cuatro causas distintas, y ninguna era la cuota:

| | qué pasó |
|---|---|
| **1. Se quedó sin PASOS, no sin cuota** | el modelo agotó `maxSteps: 8` llamando herramientas y nunca redactó. `chatCheapTools` devolvía `'(se alcanzó el máximo de pasos)'` y el doer lo tiraba con un `continue` **sin escribir una línea en `erroresIA`** |
| **2. El veredicto juzgó con los restos** | `causaDelFallo` recibía una lista donde sólo quedaban los errores de los proveedores que no importaban — y **Mistral devuelve 429 SIEMPRE** (`limit-req-minute: 0`, medido con la key del cliente), así que la regex de cuota matcheaba garantizado |
| **3. El respaldo no existía** | `provsDe` devolvía **cero** instancias de OpenAI desde el 13/08. Es el último escalón de las tres cascadas |
| **4. El «4» no eran intentos** | `contarKeysIA` cuenta FILAS en `credenciales` de cinco proveedores; la cascada del doer llega a dos |

⚠️ **AGOTAR LOS PASOS NO ES UN FALLO: el modelo YA TRABAJÓ y lo único que falta es que
ESCRIBA.** Todo el trabajo está en `msgs` (las `tool_calls` y sus resultados), así que un
pedido más **sin herramientas** lo cierra: es el request más barato del turno y es lo
único que el modelo no podía hacer solo — con `tools` puesto puede volver a llamar en vez
de redactar. Va sin `tools` y **no** con `tool_choice: 'none'`: ese valor lo aceptan
OpenAI y Groq y no está garantizado en la capa compatible de Gemini, que es justo el
proveedor del caso. Y envuelto: si el cierre falla, vuelve el centinela y decide el caller
(`cerrarSinTools`).

⚠️ **`clavesCargadas` DEVUELVE `[]` POR DOS RAZONES Y `provsDe` LEÍA UNA SOLA.** Una es
«este workspace no tiene ninguna cargada»; la otra es «este proveedor no admite varias
cuentas», que es OpenAI —cobra por token, así que una segunda cuenta no suma cuota, suma
factura— y su nombre de clave lo da el fallback `${NOMBRE}_API_KEY`. El propio
`ia-keys-ws.ts` lo dice en su comentario: *«los dos casos dan [] y se distinguen
preguntando primero por el catálogo»*. Ese loop no preguntaba, desde el commit `85a020b8`
(13/08/2026, cuando pasó de `clavesProv` a `clavesCargadas`).

El alcance es todo el producto, no el doer: **OpenAI es el último escalón de
`CASCADA_GRATIS`, `CASCADA_DOCS` y `CASCADA_STT`** —el respaldo que existe justo para
cuando los gratis se caen— y no corrió ni una vez en seis semanas. Y como
`cheapDisponible()` y `sttDisponible()` iteran eso, a un workspace cuya **única** key sea
de OpenAI el producto le contesta «no tenés IA» teniéndola cargada. No da error, no deja
log: una lista vacía es una respuesta válida. La decisión se mudó a `clavesAProbar`
(`lib/ia-keys.ts`, sin `server-only`) para que tenga test — en `ai-cheap` ningún test la
podía importar.

⚠️ **EL 413 DE GROQ SE LEÍA COMO CUOTA AGOTADA.** Su mensaje es *«Request too large … on
tokens per minute (TPM): Limit 8000, Requested 12437, please reduce your message size …
Visit https://console.groq.com/docs/rate-limits»*, y **la URL de la documentación trae
`rate-limits`**: la regex de cuota matchea sobre un error que no tiene nada que ver con la
cuota. Dos daños: le echa la culpa a las cuentas del cliente por algo NUESTRO (le mandamos
un prompt que no entra en el tope de entrada de ese proveedor) y le dice «reintentá en un
rato» sobre lo único que no se destraba con el tiempo. Es una causa aparte
(`mensaje_muy_largo`), **sin link y sin «reintentá»**: cargar otra key no cambia el tope.

Y se **SACA de la lista**, no se descarta la lista entera: si otro proveedor rebotó con un
429 de verdad, ése sigue siendo el veredicto. Al revés es el mismo bug con el signo
cambiado.

⚠️ **UN PROVEEDOR QUE REBOTA SIEMPRE NO ES UN ESCALÓN DE LA CASCADA: ES UN VEREDICTO
FABRICADO.** Mistral (429 siempre) y Cerebras (402 en sus siete keys, medido el 12/08)
sólo agregaban una línea de «rate limit» garantizada a la lista con la que se decide. La
regla ya estaba escrita para Cerebras y seguía en la cascada del doer como string muerto.
**Antes de dejar un proveedor en una lista, probá la key que YA está en la base.**

⚠️ **Y EL 429 DEL DOER NO SE ANOTABA EN NINGÚN LADO.** `anotarRebote429` tenía **un solo
call site**, en `chatCheapCascade` — la cascada SIN herramientas, que el doer no usa.
Medido: **4.497 filas en `anthropic_usage` y CERO con la marca de rebote**, así que para
contestar «¿qué pasó a las 20:30?» hubo que salir a pegarle a la API de Google a mano. Y
esa marca es la que después usa `ordenarPorCuota` para no volver a arrancar por la cuenta
muerta: sin ella, cada llamada paga el peaje del 429. Es «cerrar cuatro deja la quinta»,
otra vez.

⚠️ **Y UN NÚMERO QUE SALE DE CONTAR FILAS NO PUEDE AFIRMAR INTENTOS.** «Probé tus 4
cuentas y las 4 me rebotaron» mezclaba dos preguntas en una variable: cuántas keys tiene
el cliente (que es la que elige la RAMA del mensaje — con dos o más, pedirle «cargá otra»
es un insulto porque ya lo hizo) y cuántas se probaron. El número dejó de salir escrito.

**Lo que quedó SIN hacer:**

- **`maxSteps: 8` sigue en 8** (`lib/mako-doer-in.ts`). El cierre sin herramientas lo
  vuelve inocuo en el caso medido, pero nadie midió cuántos turnos lo agotan ni por qué —
  la feature `*-cierre` de `recordUsage` existe para poder contarlo.
- **`contarKeysIA` sigue contando filas** y sigue decidiendo `sin_respaldo` vs
  `proveedor_caido`. Para eso es correcto; si algún día hace falta «cuántas probé», el
  dato está en `erroresIA` y hay que pasarlo.
- **OpenAI volvió a ser alcanzable y COBRA** (gpt-4o-mini). Es lo que estaba diseñado y es
  centavos, pero ahora corre de verdad: si no se lo quiere en el doer, se saca de `cands`
  en una línea.

*2026-09-30*

---

## Un prompt que ORDENA usar diez herramientas que no se mandaron: el turno no tiene desenlace bueno

**Vive en:** `lib/mako-doer-in.ts` (`DOER_WA_VOZ` / `DOER_WA_TOOLS`, el armado de `system`) ·
`lib/ai-cheap.ts` (`chatCheapTools`)

Martín, el 01/10/2026, con la captura del grupo de un cliente de una agencia: *«Realmente
hay que solucionar esto, es un producto totalmente defectuoso que MaKo cada 2 mensajes te
diga esto»*. Lo que MaKo le había contestado a «hola mako, como venimos de reuniones los
ultimos 15 dias» era **«⚠️ Te quedaste sin cuota de IA»** — con la key de ese cliente
contestando HTTP 200.

**No era exageración.** Medido en `mako_doer_conv`: a ese cliente el cartel le salió en
**16 de sus 53 turnos (30%)**, y en **las SEIS veces** que preguntó por sus agendas. Es una
inmobiliaria de generación de leads: las agendas SON el producto.

La cadena, entera:

| | qué pasó |
|---|---|
| 1 | `clasificarIntencion` leyó «hola» al principio → `charlar`, cuyo contrato es `tools: []` |
| 2 | el ROUTER, en cambio, lo leyó como un pedido de datos («reuni», «ultimo») → tier sonnet, así que no tomó el camino barato |
| 3 | el turno entró al loop de tool-use con el array VACÍO y con el preámbulo entero: **8.516 caracteres que nombran diez herramientas y ORDENAN usarlas** |
| 4 | Groq → **HTTP 400** «Tool choice is none, but model called a tool». Gemini → **HTTP 200 con el contenido vacío** y `finish_reason: tool_calls` |
| 5 | como nadie contestó, corrió la red de plataforma —keys de la AGENCIA— y los 429 de mistral eligieron el texto que leyó el cliente |

⚠️ **Y LA LISTA VACÍA NO ERA LA CAUSA: ES EL PROMPT.** Es lo que refutó la medición en vivo
contra las dos APIs, y cambió el arreglo entero:

| system | body | Groq | Gemini |
|---|---|---|---|
| corto, no nombra herramientas | `tools: []` | **200**, contesta bien | — |
| el preámbulo del doer | `tools: []` | **400** (3/3) | **200 con content vacío** (2/2) |
| el preámbulo del doer | SIN el campo `tools` | **400** (2/2) | **200 con content vacío** (2/2) |

O sea que «mandalo por el camino sin tools» no arregla nada: lo que rompe es pedirle al
modelo que llame algo que no recibió. Es «una regla en un prompt no es una regla» con el
signo dado vuelta — **un prompt que PROMETE una capacidad que la API no concede**. El
protocolo de herramientas se partió en su propia constante y sólo viaja si `tools.length`,
y el `system` se arma **después** de las tools (estaba veinticinco líneas más arriba, o sea
antes de poder mirarlas).

⚠️ **Y AL SACAR UN BLOQUE DE PROMPT, ENUMERÁ QUÉ REGLAS VIVÍAN ADENTRO.** «nunca inventes
nombres, números ni fechas» era una frase del protocolo de tools, así que se fue con él.
Medido el 02/10 contra Groq con el system ya partido y sin esa línea: contestó en 548 ms
**«hemos tenido 6 reuniones: 3 internas (planificación, revisión de KPIs, brainstorming), 2
con cliente…»** — seis reuniones que no existen, con su desglose. **Eso es peor que el
cartel que vino a reemplazar: un número inventado no se lee como un error.** Con la línea
puesta: «Eso lo miro y te lo paso.» El camino barato de al lado ya lo sabía y lo decía en
su propio system; era la tercera escritura de la misma regla y la única que faltaba.

⚠️ **Y `tools: []` NO ES «no mandar herramientas».** Groq resuelve `tool_choice` a `none` y
contesta 400 si el modelo igual emite una llamada. Con la lista vacía no viajan **ni
`tools` ni `tool_choice`**.

⚠️ **Y EL CONTRATO SE APLICABA AL DECLARAR Y NO AL EJECUTAR.** Gemini, con `tools: []`,
devolvió un `tool_calls` pidiendo `metricas_negocio` — un nombre que sólo estaba en el
TEXTO del system — y el código **la ejecutaba**: nadie miraba la lista. O sea que recortar
las tools por intención era una sugerencia. El caso caro no es una lectura de más: es
`proponer_tareas_plan`, que crea un borrador de verdad sobre un saludo, que es exactamente
el bug que ese recorte vino a cerrar. La guarda va **con un corte**: devolverle el error y
seguir deja que lo reintente, y con la lista vacía eso quema los 8 pasos.

⚠️ **Y UN 200 CON EL CONTENIDO VACÍO SE REPORTABA COMO UN CIERRE NORMAL.** Devolvía el
centinela `'(sin respuesta)'` con `stopReason: 'stop'` — la MISMA forma que usa el caller
para descartar—, así que el motivo que se escribía decía «fin=stop», lo contrario de lo que
pasó. El `finish_reason` real era `tool_calls` y lo estábamos tirando.

*2026-10-02*

---

## Los errores de NUESTRAS credenciales no eligen el texto que lee el cliente

**Vive en:** `lib/fallo-ia-texto.ts` (`causaDelFallo`, `ContextoFallo`) ·
`lib/mako-doer-in.ts` (`erroresPlataforma`) · `lib/ai-cheap.ts` (`provsGratisDePlataforma`)

En el turno del 01/10 la lista con la que se eligió el mensaje tenía **ocho entradas: UNA
del cliente y SIETE de la agencia (87,5%)** — y los únicos tres 429, lo único que matchea la
regex de cuota, eran `plataforma/mistral`. El «te quedaste sin cuota de IA» que leyó un
cliente **lo fabricaron íntegramente nuestras propias keys**.

`causaDelFallo` no las podía distinguir: su firma era `(errores: string[], keys: number)` y
juntaba todo con un `join`. Se separan **en el origen** —`erroresIA` y `erroresPlataforma`—
y no por un prefijo adentro del texto: una convención dentro de una cadena libre es justo lo
que esta casa ya pagó dos veces.

⚠️ **Y FILTRAR LA PLATAFORMA NO ALCANZA.** Medido: con sólo la entrada del cliente el
veredicto pasa de `sin_cuota` a `sin_respaldo`, que dice «Tu proveedor de IA se cayó justo
ahora… carga una segunda key». **También es falso**: su proveedor no se cayó, contestó 200.
Al conjunto de causas le faltaba la honesta, y es la que el cliente no puede accionar:

- **`fallo_nuestro`** — las keys del cliente contestaron y el problema fue nuestro. **Sin
  link y sin «cargá otra»**: no hay nada que él pueda hacer. «No pude contestar: tu IA
  respondió bien y el problema fue mío.»
- Y **un 200 del cliente manda sobre cualquier texto de error**, incluso si al lado hay un
  429 de otra cuenta suya: es la prueba más fuerte que hay de que del otro lado estaba bien.

⚠️ **Y CERO INSTANCIAS PROBADAS NO ES «SE CAYÓ TU PROVEEDOR».** Pasa cuando hay filas en
`credenciales` pero ninguna resuelve, y el veredicto afirmaba una caída que nadie vio. Por
eso `causaDelFallo` recibe ahora **cuántas se probaron y cuántas contestaron**, que son dos
hechos que ningún texto de error puede decir.

⚠️ **Y MISTRAL SEGUÍA EN LA RED DE PLATAFORMA.** El 30/09 se lo sacó de la cascada propia
del doer porque su 429 crónico (`limit-req-minute: 0`) le FABRICA el veredicto de cuota a
cualquier falla — y quedó vivo en la lista que corre **cuando al cliente no le contesta
nadie**, o sea en el peor momento posible. Es «sacar un patrón es ENUMERAR dónde está, no
arreglarlo donde se vio», otra vez: eran dos listas y se arregló una.

**Lo que quedó SIN hacer:**

- **El consumo de las keys de la AGENCIA se registra en el workspace del CLIENTE**
  (`recordUsage` toma el ws del contexto), así que le ensucia su gauge de cuota. Es a
  propósito que se VEA en su Saldo; lo que falta es que no cuente para su cuota.
- **`contarKeysIA` sigue sin ver OpenAI.** La mitad grande se arregló en la misma pasada —
  `clavesEnBase` devuelve `null` cuando la lectura FALLA y un Set vacío cuando el workspace
  no tiene ninguna credencial, que eran dos cosas y daban lo mismo: un workspace sin una
  sola fila contaba **40** keys, con lo cual `sin_keys` era inalcanzable—. Lo que queda es
  que `clavesDe` devuelve `[]` para los proveedores de una sola cuenta, así que una key de
  OpenAI no se cuenta: hay que preguntarle a `credWs`, no al catálogo de cuentas múltiples.
- **El 429 de la red de plataforma no se anota** (`anotarRebote429` escribiría en el
  workspace del cliente y le prendería «agotado» un proveedor que no tiene).
- **La cascada del cliente no tiene techo de tiempo ni `timeoutMs`**: 8 pasos × 45 s por
  llamada, y recién después arrancan los 25 s de la red de plataforma.

*2026-10-02*

---

## «¿Quién es este?»: el RAG de cada cliente leía el workspace entero del dueño (01/10/2026, arreglado el 04/10)

Leila abrió el editor de una secuencia en su propio workspace, leyó un nombre que no conocía
y preguntó **«¿quién es este?»** (00:29:00). Martín: *«esos son ejemplos… está tomando
ejemplos de Mauricio siempre»*.

La causa es `wsParaRag()`: le presta a cada cliente su conocimiento **más el del
`OWNER_WS`**, con la idea de compartir el método curado de la agencia. El problema es que
**`OWNER_WS` es Mauricio, un cliente** (AGENTS.md → «`OWNER_WS` NO es la plataforma»), así
que lo que se presta no es «el método»: es su workspace entero.

**Medido contra producción antes de escribir una línea:** de las 54 entradas servibles del
ws1, **42 entraban al RAG general de los otros workspaces**, y 22 de ésas son un glosario de
NOMBRES PROPIOS sacado de sus reuniones — «Patricia Muñoz», «Francisco Hernandez»,
«Rogelio», «Zulema», «Anel», «Rocío».

### El filtro va por FUENTE, no por área, y eso es lo que hace que no envejezca

Sacar `glosario` del préstamo cerraría el caso medido y dejaría abierto el próximo:
cualquier área nueva que una reunión escriba en el ws1 se prestaría sola. La pregunta que
decide no es «¿de qué habla esta entrada?» sino **«¿la curó alguien para que la use todo el
mundo, o se la encontró un transcript?»** — `fuente: 'manual' | 'mako'` se presta,
`'reunión'` no. Y la lista va **en positivo**, porque con «todas menos reunión» la fuente
que se invente mañana entra sin que nadie lo decida.

### ⚠️ El tercer lector era el que DIBUJA, y lo encontró el test, no leer los call sites

Con los dos lectores obvios ya arreglados (`searchKnowledge` y `listActiveKnowledgeByArea`,
que inyectan lo que traen en un prompt), el guard del cableado falló con **«3 lectores
prestan y sólo 2 filtran»**. El tercero era `listKnowledgeAgencia`, que no alimenta ningún
prompt: **pinta la lista en `/conocimiento`**, o sea que los 22 nombres del dueño se leían
en pantalla.

Contar los `await wsParaRag()` y compararlos con los `sinLoAjenoDelDueno(` encontró lo que
leer los dos call sites que yo tenía en la cabeza no iba a encontrar nunca. **Un guard que
CUENTA las dos puntas vale más que uno que busca la palabra**: con un solo lector filtrado,
un `assert.match` sobre el archivo habría dado verde con la fuga abierta por el otro.

### ⚠️ Y la medición de punta a punta falló, no dio cero

El primer intento de medir la fuga de verdad —correr `searchKnowledge` para cuatro
workspaces— devolvió **0 para todos, incluido el ws9**. Eso no era un resultado: era la
medición rota. Partiendo el camino en dos (la query y el `embed()`) apareció
`embeddings: You have no credits remaining`. Un cero parejo sobre el caso que uno sabe que
tiene datos es la señal; creerle habría cerrado la búsqueda sobre una fuga viva.

**Vive en:** `lib/rag-prestamo.ts` (sin `server-only`, para que haya test) · `lib/mako-knowledge.ts` → los tres lectores de `wsParaRag` · *2026-10-04*

## Un placeholder adentro de un PROMPT va literal: `renderTemplate` no tiene escape (06/10/2026)

**Vive en:** `lib/prompt-render-pure.ts` (`renderTemplate`) · el primer caso, `lib/paso-ia.ts`

Un prompt que tiene que MOSTRARLE al modelo un placeholder —«deja el `{{lead_nombre}}` tal cual,
lo completa el sistema»— lo escribe tal cual. `renderTemplate` reemplaza sólo los slots que
recibe en `vars` (`/\{\{(\w+)\}\}/`, y únicamente si la clave está) y deja todo lo demás literal,
así que `{{lead_nombre}}` llega intacto mientras nadie pase un slot con ese nombre.

La primera versión del prompt del paso en modo IA inventó un escape (`{{"{{"}}lead_nombre{{"}}"}}`)
que no existe en ninguna parte: el modelo recibía la basura entera. No da error, y el prompt se
lee bien en el fuente si uno cree que el escape existe.

- **Antes de escapar algo en un template, mirá qué reconoce el que lo renderiza.** Acá la
  respuesta es una línea de regex.
- ⚠️ **Y no nombres un slot como un placeholder que el prompt tiene que mostrar.** Si mañana
  alguien pasa `lead_nombre` en `vars`, el prompt deja de enseñar la regla y pasa a mostrar un
  nombre real.
- El guard ejecuta `renderTemplate` sobre el template y pregunta si los placeholders llegan
  (`tests/paso-ia.test.ts`).

## `CASCADA_GRATIS` no tiene Gemini: para tres clientes, «la IA gratis» no existe (06/10/2026)

**Vive en:** `lib/ai-cheap.ts` (`CASCADA_GRATIS`, `CASCADA_DOCS`, `errorDeCascada`,
`chatCheapCascade`) · `lib/paso-ia.ts` · `app/api/chat-agent/guion-audio/route.ts` ·
*2026-10-06 wf_fe0d104c-25c, implementador de #748*

**El diagnóstico obvio era el equivocado — y lo pedía la tarea.** El guion del audio se iba a
escribir con `CASCADA_GRATIS`, «igual que `lib/paso-ia.ts`». Pero esa lista es
`['groq','openrouter','mistral','openai']`: **no tiene Gemini**. Medido en prod (sólo por nombre
de clave): el ws13, el ws15 y el ws17 tienen cargada SOLAMENTE `GEMINI_API_KEY`, y el ws14 sólo
Gemini y OpenAI. Con `CASCADA_GRATIS` esos tres workspaces no tienen a quién preguntarle.

Y el mensaje miente encima: `errorDeCascada` decide «hay IA» con `docsIADisponible`, que mira
`CASCADA_DOCS` (la que SÍ tiene Gemini adelante). Así que les contesta «Tu IA está conectada pero
no pudo… Prueba de nuevo» — un reintento que no puede andar nunca, y que le echa la culpa a un
bache cuando lo que falta es un proveedor en la lista.

- **Copy que tiene que andar con la key gratis que carga cada cliente va por `CASCADA_DOCS`**, que
  es la misma lista con la que `errorDeCascada` mide. Las dos son gratis y ninguna toca Claude.
- **HECHO el 09/10/2026: `lib/paso-ia.ts` («Lo adapta MaKo») pasó a `CASCADA_DOCS`.** En el
  ws13, ws15 y ws17 no adaptaba nunca: siempre salía el texto de respaldo, con el motivo engañoso
  «la IA vino vacío». Lo fija `tests/paso-ia.test.ts` (con `CASCADA_GRATIS` de vuelta: 1 rojo).

## Lo que rechaza `validar` no deja rastro, y el error que sale es el de otra cosa

**Vive en:** `lib/ai-cheap.ts` (`chatCheapCascade`, el parámetro `validar`) · *2026-10-06
wf_fe0d104c-25c, implementador y revisor de #748*

`chatCheapCascade` no empuja a `erroresOut` los rechazos de `validar`: si todos los proveedores
contestan 200 con algo inservible (un guion con una palabra prohibida, un número inventado), la
lista de errores llega vacía y `errorDeCascada` dice «tu IA está conectada pero no pudo» en vez
del motivo real. Quien pasa `validar` junta sus propios rechazos y dice el último — así lo hace
la ruta del guion. **Revisar los otros que validan: `productos-ia`, `ofertas-ia` y avatares.**

**HECHO el 09/10/2026, en la cascada y no en cada caller:** `chatCheapCascade` escribe
`<proveedor·cuenta>: contestó y lo descartamos (no tiene la forma pedida)` o `contestó vacío`
antes de pasar a la cuenta siguiente, con las mismas palabras que ya usaba el doer. Lo lee
`esDescarteDeLaIA` (`lib/ia-mensajes.ts`), y `motivoDeErroresCascada` lo pone ANTES que la
saturación y la cuota: si un proveedor contestó 200, la key y la cuota del cliente están bien, y
un 429 de otro proveedor de la lista no puede contestar «te quedaste sin cuota». Así los tres
callers de arriba dejan de decir «no pudo» sin motivo sin tocar ninguno. `lib/paso-ia.ts` arma su
propio motivo y ahora distingue «la IA contestó y ninguna versión respetó el original» de
«ningún proveedor contestó». Tests en `tests/ia-mensajes.test.ts`, probados rompiéndolos (3
roturas, las 3 en rojo).

⚠️ **Y un `validar` puede rechazar lo que el propio pedido exige.** El filtro del guion prohibía
«agendar» en los negocios sin link de agenda, y una secuencia con objetivo «agendar» hace que el
modelo la escriba: rechazado en CADA proveedor, con la pantalla diciendo «Prueba de nuevo». Lo que
el pedido declara (objetivo, gancho, preguntas del negocio) tiene que abrir la prohibición antes
de validar, o la validación es un candado sin llave.

Y el modo de falla de la ruta VIEJA, que es la regla del veto vista desde afuera: llamaba a
`chatClaude` con una feature que no estaba en `CLAUDE_PERMITIDO`, el veto la cortaba, y su
`catch {}` devolvía las viñetas como si fueran el guion. Cero llamadas desde el 05/08 y la
pantalla mostrando un resultado.


---

## Una nota de voz perdida porque Google estaba saturado, y un mensaje que pedía la key equivocada (07/10/2026)

**Vive en:** `lib/ai-cheap.ts` (`transcribirAudio`, `escucharCon`, `modelosSttGemini`) ·
`lib/fallo-ia-texto.ts` (`esSaturacion`) · `lib/mako-doer-in.ts` (el aviso del audio) ·
`tests/stt-red.test.ts`

Lo que mandó Martín, con la captura del grupo de Código Inmobiliario: «Envié esto por el grupo y
otra vez el problema de la API... Realmente tenemos que solucionarlo, no puede ser que sea tan
limitado. Si hay que eliminar Gemini o hacer cambios radicales, dime, pero esto tiene que
funcionar bien...». MaKo había contestado: «Me llegó tu audio pero no lo pude escuchar… Tienes
*una sola* API key cargada… Carga una segunda (son gratis)».

**Medido en los logs de Vercel (22:01:52 UTC):** `[stt] gemini falló: HTTP 503: This model is
currently experiencing high demand`, dos veces seguidas, y el mismo 503 un minuto después en el
chat. Y medido otra vez a las 22:2x con un pedido real a cada modelo, con la key de la agencia:

| Modelo | Respuesta |
|---|---|
| `gemini-flash-latest` (el de siempre) | **503 «high demand»** |
| `gemini-flash-lite-latest` | 200, 560 ms |
| `gemini-3.5-flash-lite` | 200 |
| `gemini-2.5-flash` / `-lite` | 404 «no longer available to new users» |

⚠️ **El diagnóstico obvio —y el que daba el propio mensaje— era el equivocado.** «Una sola key»
no era el problema: Google no tenía capacidad para ESE modelo, y una segunda key de Gemini le
pega al mismo Google. `tests/fallo-ia-texto.test.ts` lo fijaba al revés desde el 25/8 (un 503
«high demand» con una key → `sin_respaldo`, o sea «cargá otra»). Lo que faltaba era otra cosa —y
**ya había pasado el 16/8 con los documentos**: el mismo 503 de `gemini-flash-latest` con
`gemini-flash-lite-latest` sano al lado, que es de donde nació `MODELOS_RESPALDO`. La rotación por
modelo existía desde entonces; el audio tiene SU PROPIO loop de proveedores y nunca la recibió.
Una resiliencia escrita en un camino no protege a los caminos que no pasan por él:

1. **El reintento era en el mismo segundo, contra el mismo modelo.** Ahora un modelo saturado
   pasa al siguiente con la misma key (cada modelo tiene su capacidad y su cuota), y Whisper
   reintenta con 1,5 s de respiro. Los modelos salen de `MODELOS_RESPALDO`, la lista que el
   chat ya usaba: la primera versión del arreglo armó una propia con `gemini-3.5-flash-lite`,
   un id con versión, y esa lista dice «sólo alias `-latest`» porque los con versión ya se
   cayeron dos veces.
2. **El audio no tenía red de plataforma.** El chat del doer la tiene desde el 25/8; la
   transcripción usaba SÓLO las keys del negocio, así que ws13, ws15 y ws17 —sólo Gemini—
   perdían cada nota de voz en cada bache de Google. Ahora, si las del negocio no pudieron,
   escucha con las gratis de la agencia, **Groq primero** (otro servicio). Verificado de punta a
   punta en el ws3 (sin keys de audio): «escuchó con la RED DE PLATAFORMA (groq)», 9 s.
3. **El texto se elegía con todos los errores** y pedía una key que no arregla nada. Ahora
   `SttSinEscucha` separa los errores del negocio de los de la red, y un saturado es «no es
   nada tuyo», nunca «carga otra key».

**Y la respuesta a «¿hay que eliminar Gemini?»:** no. Gemini es la key gratis y generosa que
cada cliente carga; el problema era depender de UN modelo de UN proveedor sin red. Con los
modelos de respaldo y Groq de la agencia, un bache de Google ya no deja a nadie sin audio.

**SIN HACER:**
- **La base de conocimiento de MaKo está caída para todos**: medido en los mismos logs, `[mako-
  knowledge] RAG caído… embeddings: You have no credits remaining` — la cuenta de OpenAI DE LA
  PLATAFORMA se quedó sin crédito. MaKo contesta, pero sin lo que aprendió de cada negocio. Se
  arregla cargando crédito (decisión de plata) o pasando los embeddings a un proveedor gratis,
  que es re-embeber todo con otra dimensión (una migración).
- **Whisper alucina sobre un audio sin voz**: la prueba con un audio sin habla devolvió «¡Suscríbete
  al canal!», la alucinación clásica. Ya pasaba para los negocios con Groq; con la red de
  plataforma puede pasarle a cualquiera. Gemini contesta «(vacío)»; Whisper no tiene esa salida.

*07/10/2026, cuenta 2, commit `c67ca07c`.*

## «Te quedaste sin cuota» a la segunda pregunta: era el tope del MINUTO, y el turno se tiraba con seis pasos hechos (07/10/2026)

**Vive en:** `lib/ai-cheap.ts` (`chatCheapTools`) · `lib/ia-rotacion-modelo.ts` ·
`lib/mako-doer-in.ts` (el loop de las cuentas del cliente) · `tests/ia-rotacion-modelo.test.ts`

Lo que mandó Martín: «Revisa el grupo de brigitte, sigue con el problema de los token de IA
apenas haciendo 1 consulta... ya creo que habré enviado como 10 prompts intentando iterar
esto... proponme una solución definitiva». En el grupo (ws15, una sola key: la de Gemini) MaKo
contestó la primera pregunta y a la segunda —«¿tenés la información del lead Rosana Grandoli?»—
dijo «Te quedaste sin cuota de IA».

**Medido en `anthropic_usage` y en los logs de Vercel:**

| | |
|---|---|
| Una pregunta con herramientas | **6 a 8 pedidos de ~15.000 tokens**: el loop re-manda la conversación entera en cada paso |
| La segunda pregunta | 6 pedidos en 13 s, y el **séptimo 429** |
| La misma key, 57 min después | **200**: era el tope del MINUTO, no el del día |
| `gemini-flash-lite-latest` (respaldo) | nunca se probó en este camino |
| Red de la agencia: Groq ×2 | **413**: los 4 modelos gratis topean en 8.000 tokens/min y el pedido pesaba 13.455 |
| Red de la agencia: Gemini ×3 | 503 «high demand» ×2 y un timeout que salió como excepción del `fetch` |

⚠️ **El diagnóstico obvio —el del propio mensaje— era el equivocado.** «Cargá otra key» no
arreglaba nada: la key no estaba agotada, una pregunta sola llenaba el minuto. Lo que tiraba el
turno era una regla escrita en agosto: **«nunca reintentar después de que una tool tocó datos»**
(`toolsUsados > 0 || intento >= 1`, fijada por un guard en `tests/red-plataforma.test.ts`). Esa
regla vale para RE-ARRANCAR el turno con otro proveedor —eso vuelve a correr las tools desde el
mensaje original—, y se aplicaba a repetir UN pedido que falló, que no ejecuta nada: las tools
corren sólo con una respuesta buena y lo que ya corrieron está en `msgs`. Por eso el 429 del
séptimo paso descartaba los seis anteriores, y la red de la agencia arrancaba de cero.

Lo que quedó (`af3530c2`):

1. **Cada pedido que falla se decide en `crearRotacion`** (`lib/ia-rotacion-modelo.ts`, puro):
   un 429 o un 503 pasa al OTRO MODELO de la misma key —en el plan gratis cada modelo tiene su
   propio cupo— sin perder lo hecho, en cualquier paso. Verificado contra Google: un modelo que no
   existe → «rotar a gemini-flash-lite-latest» → usó la herramienta y contestó, 3,8 s.
2. **Sin otro modelo, la cuota del minuto se ESPERA** con lo que dice Google («Please retry in
   17s», o el `RetryInfo`), hasta 30 s, una vez por turno, y **sólo en la última cuenta del
   cliente**: con otra esperando, saltar es mejor. La del día no se espera nunca.
3. **El `fetch` va adentro del `try`**: un timeout es una excepción, no una respuesta, y no pasaba
   por ningún reintento.

⚠️ **Y GEMINI MANDA EL ERROR EN UN ARRAY** (`[{ "error": { … } }]`). `chatCheapTools` leía
`data.error.message`, así que todo error de Gemini llegaba como «HTTP 429» pelado: ni qué cuota
ni cuánto esperar, y la marca de `anotarRebote429` decía lo mismo. Para saber si era la del minuto
o la del día hubo que pegarle a mano a la key del cliente. `leerErrorProveedor` lee las dos formas
y agrega qué cuota fue.

⚠️ **Groq gratis no puede atender al doer, en ningún modelo.** Medido con la key de la agencia:
`gpt-oss-20b`, `gpt-oss-120b` y `qwen3.8-27b` topean en 8.000 tokens por minuto y `allam-2-7b` no
hace tool calling; un pedido del doer pesa 13-16 mil. O sea que la red de plataforma del doer es
**Gemini y nada más**, y Groq sólo suma dos líneas de error por turno.

**SIN HACER:**
- **Los tokens por pregunta son la palanca grande**: ~15.000 por paso × 6-8 pasos. Dónde se van
  vive en `lib/mako-doer-in.ts` (las tools del turno y el presupuesto de 12.000 caracteres del
  registro). Bajarlo a la mitad es duplicar cuántas preguntas entran por minuto, para todos.
- **La red de la agencia re-arranca el turno de cero**: vuelve a correr las tools que ya corrieron
  con la key del cliente (`lib/mako-doer-in.ts`, el `for` de `distintoPrimero`). Con lecturas no
  duplica nada pero paga los mismos 6 pedidos otra vez.
- **El mensaje de «sin cuota» pide «cargá otra key»** (`lib/fallo-ia-texto.ts`). En Gemini el cupo
  es por PROYECTO de Google: una segunda key del mismo proyecto comparte el balde. Tiene que decir
  «de otra cuenta de Google». No se tocó: ese archivo lo estaba editando otra sesión.
- **Un último recurso PAGO** (una key de Gemini con facturación en la agencia) es lo único que
  hace «nunca» verdadero. Es una decisión de plata, de Martín; el costo por pregunta hay que
  medirlo contra el precio de lista del día antes de decidir.
- **La cuenta de OpenAI de la plataforma sigue sin crédito** (el RAG de todos, ver la entrada
  anterior).

*07/10/2026, cuenta 2, commit `af3530c2`.*

### El segundo caso: un TIMEOUT a mitad del turno, y un cartel que la mandó a cargar lo que no la cubre (23/10/2026)

**Vive en:** `lib/ia-rotacion-modelo.ts` (reglas 4 y 5, `PLAZO_REINTENTOS_TURNO_MS`) · `lib/ai-cheap.ts`
(`chatCheapTools`, `hastaMs`) · `lib/mako-doer-in.ts` (`plazoDe`, `propuestasDelTurno`) · `lib/fallo-ia-texto.ts`
(`ia_lenta`) · `lib/respuesta-doer.ts` (`conLoQueQuedoPropuesto`) · `tests/doer-timeout-gemini.test.ts`

**La regla es UNA, en dos mitades:** el respaldo es SIEMPRE una IA del negocio, nunca la de MaKo. Si queda otro modelo
de SU key, va ése; si queda otra IA suya de otra marca, va ésa; si no queda nada, se le dice qué pasó. Esta es la mitad
de las keys. La mitad de la computadora del dueño (la PC que no contesta deja 90 s para su clave: `RESERVA_RESPALDO_MS`,
`claveDeIAPropia`, lib/ia-pc-reglas.ts) la escribió el chat «IA del cliente» en «Gemini en la PC: no».

Lo levantó el vigía: Brigitte (ws15, otra vez UNA key de Gemini) contestó «Si contacte Eli» al recordatorio de las
13:51. Dos pasos de `flash-lite` con 200 (+23 s y +34 s del mensaje; `flash-latest`, el fijado, falló antes sin dejar
marca de 429), el tercero no volvió, y a los +83 s salió `cartel:sin_respaldo` con «chatCheapTools(gemini): The
operation was aborted due to timeout»: «Tu proveedor de IA se cayó justo ahora… Carga una segunda (son gratis)».

⚠️ **El diagnóstico del cartel era el equivocado, y ella le hizo caso.** Gemini no se cayó (los dos pasos de antes
contestaron), y a los 33 minutos cargó `GEMINI_API_KEY_2`, que le pega al mismo Google: una segunda key del mismo
proveedor no cubre a un modelo lento, igual que no cubre a uno saturado (la entrada del audio, arriba). El 13/10 el ws13
había recibido el mismo cartel por la misma causa.

⚠️ **Por qué murió, sin logs (Vercel ya no los tenía): sale de los relojes.** +83 s = el 200 de +34 s + 45 s de
timeout + ~4 s, o sea que el timeout NO tuvo reintento. Con la rotación de entonces eso sólo pasa si el reintento del
paso ya estaba gastado: un fallo rápido de saturación (un 503 o un «fetch failed»), 1,2 s de pausa, y el reintento
colgado. El timeout era una saturación más y compartía con el 503 el ÚNICO reintento del paso. Y no había techo: un paso
podía quemar 136 s (tres timeouts de 45 y la pausa).

⚠️ **45 s NO es corto para Gemini con herramientas**, que era la otra sospecha. Medido en el doer del 10 al 24/10, de
paso a paso (herramienta incluida): `flash-latest` p50 6,7 s, p90 24,8 s, máximo 32 s; `flash-lite` p50 2,3 s, p90 25 s.
Bajar el timeout cortaría pasos sanos; subirlo sólo alarga la espera del que se colgó.

Lo que quedó: un timeout tiene su regla (otro modelo de la misma key si queda; si no, el MISMO una vez por TURNO, aparte
del reintento del 503), y los reintentos tienen plazo: 100 s por proveedor desde su primer pedido, ninguno arranca sin
15 s por delante y el que arranca va cortado a lo que queda. El primer pedido de cada paso no se corta nunca: después de
una herramienta, el cierre es lo que dice qué se hizo. Nunca un respaldo de la plataforma: todo sale de las keys del
negocio. El cartel nuevo (`ia_lenta`) dice qué IA tardó, que cortamos nosotros, que lo mande de nuevo y, si toda su IA es
de una marca, cuál le da respaldo, con el link al modal de ESA (`?abrir=openai`).

⚠️ **El cartel ofrece su GPT y no su Claude, a propósito.** En WhatsApp su Claude entra sólo si el turno no corrió
ninguna herramienta (WA1, `corridasDelTurno === 0`): justo en este caso, que se colgó después de dos, no estaba. Un test
avisa si WA1 cambia.

⚠️ **Y el turno muerto había dejado algo hecho.** El segundo paso creó la pendiente #381 «Mover a ELi → etapa
"Seguimiento 1"» (`mako_acciones_pendientes`), y el cartel no la nombró: quedó viva dos horas sin que nadie la viera —a
las 15:14 su «Bien» al aviso de un lead nuevo se ruteó como `(confirmación)` por ella— y venció sola. Ahora cualquier
cartel (`avisoDeSistema`) termina con lo que el turno dejó esperando un «sí» y le pide el «sí» en vez de que lo mande de
nuevo (eso dejaba una segunda pendiente igual).

**SIN HACER:**
- **`flash-latest` falla de entrada en 10 de 14 turnos del ws15** (17 al 24/10: la primera fila es de `flash-lite`), y
  sin marca de 429. Cada turno paga ese pedido fallido antes de empezar. Qué devuelve no se midió (hace falta un log en
  vivo); vive en el pin global de /modelos-ia (`mako.modelos`: `gemini-flash-latest`) y en `MODELOS_RESPALDO`.
- **El reintento con la herramienta forzada va sin `clave: inst.clave`** (`lib/mako-doer-in.ts`, `r2`): usa la cuenta
  base del proveedor aunque el turno venga de la cuenta 2.
- **Las transcripciones de anuncios usan la MISMA key a la vez** (`anuncios-transcribir` a las 14:04:39 y 14:05:15, en
  medio del turno). No se midió si compiten; con una key gratis es la primera sospecha si vuelven los timeouts.

*24/10/2026 — sin subagentes. 16 roturas en `tests/doer-timeout-gemini.test.ts`, todas con su fallo.*

## Re-arrancar el turno repetía las ACCIONES, no sólo las lecturas (07/10/2026)

**Vive en:** `lib/turno-sin-duplicar.ts` · `lib/mako-doer-in.ts` (`memo`, `nuevoIntento`,
`runTool`) · `lib/mako-pendientes.ts` (`crearPendiente`) · `lib/api-mako/acciones.ts` ·
`lib/mako-doer-acciones.ts` · `tests/turno-sin-duplicar.test.ts`

El doer de WhatsApp vuelve a correr el turno ENTERO —desde `msgs`, con las mismas
herramientas— en cinco lugares: la siguiente cuenta del cliente, el reintento con la
herramienta forzada, la red de plataforma, el escalado a Claude y el camino de Groq. La entrada
de arriba ya lo anotaba para las lecturas («no duplica nada pero paga los mismos pedidos»). Con
una ACCIÓN sí duplica: el primer proveedor proponía, se caía o devolvía algo descartado, y el
segundo volvía a proponer. `crearPendiente` era un INSERT pelado, así que quedaban dos
pendientes iguales: el «sí» contestaba «Hay 2 acciones pendientes, aclara cuál», y confirmadas
las dos eran dos eventos y dos invitaciones. Lo mismo un segundo borrador del plan, o un «sí»
que se volvía a mandar. `chatCheapToolsCascade` tenía su guarda; el loop del doer, no.

⚠️ **La guarda que ya había —«no rotes si ya hay borrador»— cubría UN camino de cinco.** Miraba
`linkBorrador` sólo en la rotación por validación; el `continue` de «contestó sin texto final»
y el `catch` rotaban igual con el borrador creado.

Lo que quedó, en dos capas:

1. **En el doer: lo que una acción hizo en un intento ANTERIOR del turno se le devuelve al
   intento nuevo, sin volver a correr** (`crearMemoDeAcciones`). Cada corrida recibe
   `nuevoIntento()` en vez de `runTool`, y el test exige que ninguna reciba `runTool` pelado:
   un camino de reintento nuevo que se olvide de abrir intento se cae en el push. Dentro de un
   intento se puede llamar varias veces (mover dos leads distintos); se cuenta por orden. Lo que
   no hizo nada (`ok:false`, `isError`) no se guarda, así el intento siguiente lo intenta de
   verdad.
2. **En los datos: la misma pendiente no se guarda dos veces en un turno**
   (`pendienteRepetida`, por grupo, tipo y payload con las claves ordenadas). Sólo en el turno:
   reusar una de un mensaje anterior le saltearía el candado de «no se confirma en el mismo
   turno en que se propuso», que mira `created_at`.

⚠️ **Por qué no se cortó la rotación**, que era la salida que aparecía primero: dejaría sin
respuesta a la persona cuando el primer proveedor se cae después de proponer, y la rotación es
lo que mantiene a MaKo andando con una sola key (`af3530c2`, la entrada de arriba).

⚠️ **Y dos condiciones del primer memo eran código muerto**, lo delataron las roturas que no
tumbaban nada: comparar el intento de lo guardado (la k-ésima llamada siempre consulta antes de
anotar, así que dentro del mismo intento nunca hay nada) y saltear las lecturas al consultar (una
lectura nunca se anota). Se sacaron.

**SIN HACER:** las propuestas de PANTALLA que crea el registro sin `ref`
(`proponerPantallaGenerica`) no tienen red de datos: un mismo intento que llama dos veces la
misma acción deja dos links. El memo ataja la rotación, que era el bug.

*07/10/2026 — sin subagentes (el diagnóstico venía medido por la revisión de la agenda). 12
roturas en `tests/turno-sin-duplicar.test.ts`, todas con su fallo.*

## Dónde se van los 14.500 tokens de una pregunta al doer, y lo que Gemini ya cacheaba (08/10/2026)

**Vive en:** `lib/mako-doer-in.ts` (`DOER_WA_TOOLS`, la selección de tools, el armado del system)
· `lib/mako-context.ts` (`buildSystemPrompt`, `hechosMako`) · `lib/anthropic-usage.ts`
(`recordUsage`) · `lib/ai-cheap.ts` (`chatCheapTools`)

Medido reconstruyendo con el código de HEAD el primer pedido de la pregunta de Brigitte (ws15,
07/10, 14.491 tokens reales; la reconstrucción coincide con el log: las mismas 20 tools del
registro y las mismas que quedaron afuera por el tope). Divisor calibrado: 3,96 caracteres por
token.

| Parte | Tokens | % |
|---|---|---|
| Esquemas de tools (43) | 7.796 | 53,8 |
| · las 25 «de siempre» | 4.758 | 32,8 |
| · · `proponer_tareas_plan` sola | 1.403 | 9,7 |
| · las 18 del registro | 3.039 | 21,0 |
| System propio del doer | 2.989 | 20,6 |
| · `DOER_WA_TOOLS` (texto de protocolo) | 2.181 | 15,1 |
| · · la receta de cargar tareas al plan | 1.149 | 7,9 |
| Base de `buildSystemPrompt` | ~3.568 | 24,6 |
| Historial y mensaje | 137 | 0,9 |

⚠️ **El costo es el PREFIJO re-enviado, no los resultados.** El loop manda system + tools + toda la
conversación en cada paso: en 7 días el 95,9% del input es el primer pedido repetido (89,8% en 30
días); los resultados de las tools suman 4-10% (el tope de 12.000 caracteres por resultado casi
nunca se toca). Achicar resultados no sirve; achicar el prefijo, sí.

⚠️ **Lo que viaja de más**: en una pregunta del CRM (consultar/pensar) van las 7 `proponer_*`
viejas, la receta del plan (4.552 caracteres) y las de lead, agenda y presupuesto, aunque el turno
no cargue tareas: −3.769 a −4.437 tokens por pedido (−26/−31%) si viajan sólo cuando viaja su
tool. El registro ya no manda sus acciones fuera de `actuar`; las viejas, sí. Y el tope de 12.000
caracteres del registro deja afuera lo útil: con «pasá a Juan a agenda» quedan afuera 30 del crm,
entre ellas `asignar_closer_setter` y `agregar_nota_lead`. El índice `id: título` de las 114
operaciones de crm+ads pesa 6.110 caracteres, MENOS que los 18 esquemas que viajan hoy (12.041).
Un índice de las 498 no sirve: 26.324 caracteres. Tiene que ser por área.

⚠️ **EL DIAGNÓSTICO OBVIO —«bajemos tokens»— PUEDE SER EL EQUIVOCADO, por dos cosas medidas:**

1. **Gemini ya cachea el prefijo.** Con la key de la agencia contra el mismo endpoint del doer: el
   2º pedido con el mismo system y las mismas tools vino con `cached_tokens` = 86% (16.349 de
   18.931). La tabla decía 0 en todas las filas porque `recordUsage` sólo leía la forma de Claude
   (`cache_read_input_tokens`); desde `949bd68b` lo anota. En plata, el prefijo ya salía barato.
   Si lo cacheado cuenta para el tope por minuto, Google no lo documenta.
2. **No se sabe qué tope se pasó el 07/10.** El 429 se guardó como «HTTP 429» pelado (Gemini manda
   el error en un array, arreglado en `af3530c2`). Los datos no distinguen pedidos de tokens: 6
   pedidos aceptados en 12,6 s (~92k tokens) y el 7º rebotó; el 09/09 la key del ws1 aceptó 8
   pedidos y 103k tokens en 43 s sobre el mismo modelo. El único 429 completo que leímos de
   `gemini-flash-latest` (16/08) era de PEDIDOS (límite 20). **Si el tope es de pedidos, lo que
   sirve es bajar PASOS, y cargar esquemas a pedido —que agrega un paso— empeora.** Desde
   `949bd68b` qué tope fue queda adelante del mensaje y entra en la marca del rebote.

⚠️ **Cambiar la lista de tools a mitad del turno invalida el caché**: medido, `cached_tokens` pasa
de 12.253 a 0 al agregar una tool. Groq (`gpt-oss-20b`) y Gemini aceptan que la lista crezca y
llaman la recién cargada, pero cada carga vuelve a pagar el prefijo entero.

**HECHO el mismo día (`3950e7cd`), con la decisión de Martín «la ofrece»:** en una pregunta
(consultar/pensar) no viajan las herramientas que ESCRIBEN —lo dice el `tipo` del registro— y MaKo
OFRECE la acción en una línea; el «sí» a ese ofrecimiento llega como `actuar`, con todo
(`makoPreguntoAlgo` + regla 3-ter de `lib/mako-intencion.ts`). Las recetas del protocolo viajan sólo
con su herramienta (`lib/doer-recetas.ts`, puro y con test). Medido: en una pregunta, las herramientas
de siempre bajan de 19.227 a 8.586 caracteres y el protocolo de 8.481 a 1.164 — **−4.535 tokens por
pedido (−31%)**; en `actuar` no cambia nada. El protocolo base pide además todas las lecturas en el
MISMO paso, que es lo que baja PASOS si el tope resulta ser de pedidos.

⚠️ **El diagnóstico de la primera versión del plan sobre el «sí» era falso, y el refutador lo cazó:**
se daba por hecho que el «sí» que sigue a una pregunta caía en `actuar`. En HEAD caía en `charlar`
(«sí, movelo a agendado») o en `pensar` («sí, hacelo»), y sacar las herramientas de una pregunta sin
tocar el clasificador habría dejado a MaKo ofreciendo algo que después no podía hacer.

**SIN HACER:** el índice por área con esquemas a pedido (fase 3 del § 10), que espera saber si el
tope es de pedidos o de tokens (desde `949bd68b` el rebote lo dice). Pasar la base a «lean» (sólo
persona + núcleo) sacaría ~2.000 tokens más, pero el 19/07 se descartó porque Sonnet fallaba en
proponer→confirmar, y no está medido en Gemini.

*08/10/2026, cuenta 2. Corrida `wf_88a97c1e-c89`; commits `af3530c2`, `949bd68b` y `3950e7cd`.*

## Un 200 con un BUCLE adentro salía como la transcripción del audio (08/10/2026)

**Síntoma:** el tramo 0:00-7:00 de un audio de Martín (1,6 MB) volvió de `transcribirAudio` con un
minuto de habla y después «1 2 3 … 699»: 3.492 caracteres, el 77% números. Los seis minutos
siguientes no estaban. Gemini contestó HTTP 200 con `finishReason: STOP`. Whisper (Groq) transcribió
bien el mismo tramo.

**El diagnóstico obvio era el equivocado:** «se cortó por el techo de salida». No: el chequeo de
`finishReason` caza la transcripción CORTADA; ésta es la falla espejo, una transcripción INFLADA por
un decodificador en bucle que después terminó «bien». Y no era «Gemini» a secas: por el orden del
log, contó el modelo de RESPALDO (`gemini-flash-lite-latest`) justo después de un 503 del de siempre
(inferido, no medido). Por eso el corte prueba la cuenta siguiente (`continue`) y no cierra el
proveedor (`break`).

**Causa:** la cascada tomaba cualquier texto no vacío como éxito. Es «`res.ok` no es "salió bien"»
del lado del contenido.

**Vive en:** `lib/stt-degenerado.ts` (`salidaDegenerada`, `UMBRAL_DEGENERADO`) · `lib/ai-cheap.ts`
(`transcribirAudio`, en las dos redes) · `tests/stt-degenerado.test.ts`

**Regla:** una salida de STT es una transcripción recién después de pasar `salidaDegenerada`. Un
bucle es un FALLO de esa cuenta: se anota con su motivo y se prueba la siguiente. No se recorta lo de
antes (media transcripción se lee igual que una completa); si nadie más escucha, `SttSinEscucha`.

**Los umbrales**: 50 o más enteros seguidos cae siempre (las cuentas reales del corpus llegan a 20);
una repetición cae si se repite 8 veces o más, tapa 30 palabras o más y ocupa el 30% del texto o más.
Calibrado contra 9.719 transcripciones de `public/cono-tx`: 0 falsos positivos en textos enteros, 3
en 392.939 párrafos sueltos (una canción «La, la, la» y dos en el borde).

**Dos trampas que costaron una vuelta:**
- **El corpus «bueno» no era bueno.** `public/cono-tx` ya trae decenas de bucles de Whisper («no no
  no» ×57, «Thank you» ×85 al final, un archivo entero de «Thank you»). Calibrar contando todo lo que
  cae como falso positivo habría subido los umbrales hasta no ver nada: hubo que leerlos a mano.
- **El motivo del error no puede llevar números ni la frase.** `causaDelFallo` clasifica la lista de
  errores con regex: un conteo que llegue a 429, 503 o 413 se leería como cuota, saturación o tamaño.
  Los números van al log.

**Lo que no detecta:** conteos en palabras, conteos con otro paso, bucles con variaciones, y bucles
chicos al final de un texto largo (a propósito: el «Thank you» del silencio del cierre no se lleva
la reunión).

**Cerrado el 13/10/2026:** `lib/transcribe.ts` también lo pasa, en sus TRES pedidos a un STT (la
cascada de Whisper de los cursos, `sttGemini` y el whisper de los anuncios). En la cascada un bucle
se anota y se prueba el que sigue; en Gemini tira; en un anuncio es `status: 'error'`.
`tests/transcribe-degenerado.test.ts` cuenta un detector por pedido: un camino nuevo que transcriba
sin pasarlo lo hace caer (probado rompiéndolo, 4 roturas).

**Sigue sin hacer:** `escucharCon` no prueba el otro modelo de la misma key ante un bucle; no se
corrió contra la red real (cada llamada escribe filas de uso en prod); y lo ya publicado en
`public/cono-tx` con bucles adentro sigue ahí (ver hallazgos-conocimiento → «Transcripciones
publicadas con BUCLES»). · *2026-10-08 / 2026-10-13 Customer Success*

## Google le bloqueó el PROYECTO a la key de Gemini del ws1, y el mensaje culpaba a «la configuración de MaKo» (11/10/2026)

**Síntoma:** el AI Analyst del Dashboard, en el ws1 (Mauricio), contestó «Hay un problema de
configuración de MaKo con ese proveedor de IA: el modelo que teníamos puesto ya no está disponible. No
es tu key», con `gemini: HTTP 403 · openrouter: This model is unavailable for free… · mistral: HTTP 429`.

**Causa, medida pidiendo el cuerpo del 403** (sin imprimir la key): la única key de Gemini del ws1
(`GEMINI_API_KEY`, termina en `…YTBA`) contesta **«Your project has been denied access. Please contact
support.» (`PERMISSION_DENIED`)** a cualquier pedido, no sólo a éste. El último uso bueno de Gemini del
ws1 en `anthropic_usage` fue el 11/10 a las 06:52 UTC (896 llamadas en 3 días). ⚠️ **Corregido el 15/10:
eso contaba los REBOTES** (filas con `model` = `rebote429:…`, que también son de Gemini): 120 + 491 + 271
del 08 al 10/10. El último 200 de verdad fue el **08/10 a las 20:45 UTC**; ver la entrada del 15/10. No es cuota (eso es
429) ni una key mal pegada: Google bloqueó el proyecto de Google Cloud de esa key. **Afecta a toda la IA
del ws1** que pase por Gemini, no sólo al Dashboard. Las keys del ws9 contestan bien (una 200, dos 503
por saturación).

**Y el mensaje eligió la causa equivocada:** el veredicto tomó el texto de OpenRouter
(`minimax/minimax-m3:free` ya no es gratis: «The paid version is available now») y concluyó «el modelo
que teníamos puesto ya no está disponible… no es tu key». Lo de OpenRouter es cierto y es nuestro (hay
que cambiar `MODELO_DOCS.openrouter` y el `chatModel` por defecto en `lib/ai-cheap.ts`), pero la causa
que mandaba era el proyecto bloqueado de la key del cliente, que sólo se arregla en su Google Cloud o
cargando otra key. Un 403 `PERMISSION_DENIED` merece su propia causa en `lib/fallo-ia-texto.ts`.

**Sin hacer:** avisarle a Mauricio (lo decide Martín); el 403 como causa propia; reemplazar el modelo
de OpenRouter. **Vive en:** `lib/ai-cheap.ts` (`MODELO_DOCS`, `provsDe`), `lib/fallo-ia-texto.ts`.

## `chatCheapCascade` no dice qué modelo CONTESTÓ, y una clave de más en una variable compila (11/10/2026)

El AI Analyst guarda qué modelo escribió el análisis (`dashboard_analisis.modelo`). La cascada no lo
devuelve, y guardar el CONFIGURADO es la degradación silenciosa que landing-analyst ya pagó: queda en
`null` (no medido). Trampa de TypeScript: `lib/graficos-analisis-server.ts` le pasa `respondioOut` en un
objeto armado en una variable, y COMPILA aunque la función no declare ese campo (el chequeo de
propiedades de más sólo mira literales frescos). **Sin hacer:** el parámetro `respondioOut?: { provider?;
model? }` en `chatCheapCascade`, escrito donde devuelve el texto. · *2026-10-11 Graphics*

## «Google estaba saturado» explicaba UNO de los dos tramos perdidos: el otro fallaba siempre (13/10/2026)

**Síntoma.** Al sacar las tareas de las últimas tres reuniones de Martín, dos quedaron con un
tramo sin leer (`1 de 5 tramos no se pudieron leer`, `1 de 4`). El relevo lo atribuyó a que las
tres cuentas de Gemini alternaban 503 y 429, y la salida obvia era esperar y releer.

**Lo que pasó al releer.** La reunión del 13/10 salió entera. La del 12/10 volvió a perder **el
mismo tramo**, y no por cuota: `la IA no devolvió JSON válido … "detalle": **Qué hay …`. Falló en
la lectura y en el reintento, con el mismo error las dos veces.

**La causa real.** El molde del detalle (`MOLDE_DETALLE`, lib/plan-fathom.ts) arranca con
`**Qué hay que hacer**`. El modelo escribió `"detalle": **Qué hay que hacer**…",`: se olvidó la
comilla que ABRE el string y puso la que lo cierra. `repararJson` conocía cinco modos de falla y
éste no era uno: el texto quedaba afuera de un string y el parse moría en el primer `*`. El
relevo del lector lo había anotado como «un modo de falla distinto del 503» sin unirlo con el
tramo perdido — y era exactamente ese tramo.

**Por qué el reintento no podía arreglarlo.** El reintento manda el MISMO prompt al MISMO
modelo: si lo que rompe el JSON es la forma del molde, sale roto otra vez. Releer «cuando Google
se calme» nunca habría recuperado esa media hora de reunión.

**Dónde vive el arreglo.** `repararJson` (lib/json-del-modelo.ts) tiene un sexto caso: después
de `:`, un valor sólo puede arrancar con `"`, `{`, `[`, un número o `true`/`false`/`null`;
cualquier otra cosa es texto al que le falta la comilla de apertura, y se le pone. Test en
`tests/json-del-modelo.test.ts` («EL CASO DEL 13/10»), probado rompiéndolo: sin la rama, 1 fallo.
Releída la reunión con el arreglo: 4 tramos, 0 fallidos, 24 tareas.

**La regla que queda.**
- **Un tramo que falla dos veces seguidas con el MISMO error no es transitorio.** Un 503 o un
  429 cambian entre intentos; un JSON roto por la forma del prompt se repite igual. Antes de
  atribuir una pérdida a la cuota, mirar si el reintento falló por lo mismo.
- **Un molde que arranca con marcas de formato invita a este error.** Si un campo de texto
  largo empieza con `**`, `#` o `-`, el modelo tiende a tratarlo como markdown y no como el
  valor de un string. El reparador ahora lo cubre; el molde sigue igual.
- **Releer no es «correr de nuevo»: es cruzar.** De las 17 tareas que dio la relectura del
  13/10, cuatro ya estaban en la lista con otro minuto (se repitieron en el cierre de la
  reunión, y Fathom las ubicó ahí la primera vez). Contar «había 13, ahora hay 17» habría
  sumado cuatro duplicadas. Se cruzó por título y quedó UNA nueva.

**Sin hacer.** Que una extracción pedida a mano diga en pantalla que se leyó a medias sigue
pendiente: el aviso vive sólo en `console.error` (lib/plan-fathom.ts, `extraerTareasDeTexto`) y
el borrador no guarda `partesFallidas` (lib/plan-propuesta.ts). Ver `docs/relevo/lector-reuniones.md`.

## `anthropic_usage` no dice si UNA clave está viva: sólo anota los 429, y con el ws del pedido (15/10/2026)

**Síntoma.** La clave de Gemini del ws1 no contesta bien desde el 08/10 a las 20:45 UTC, y en una semana sumó 2.147
rebotes 429 (~335 por día) sin que nadie se enterara. Para frenarla y avisar (docs/diseno-ia-claves-caidas.md), lo obvio
era leer la salud de cada clave de `anthropic_usage`. No alcanza, por dos razones:

- **Sólo se anotan los 429** (`anotarRebote429`). Una clave inválida (401), un proyecto bloqueado (el 403
  `PERMISSION_DENIED` del ws1 del 11/10, arriba) o una cuenta sin crédito no quedan en ninguna tabla. Por eso OpenAI y
  OpenRouter del ws1, que tampoco contestan, ni aparecen en la medición.
- **La fila lleva el ws del PEDIDO, no el del dueño de la clave** (`wsDeProveedor`). Cuando contesta la red de la
  plataforma, su respuesta buena queda en el ws del cliente, con el mismo proveedor y quizá el mismo número de cuenta: una
  clave muerta puede verse viva por la respuesta de otra.
- **Y el rebote no dice QUIÉN llamó**: `anotarRebote429` escribe `feature = 'cuota'` fija. ⚠️ **Contado por hora,
  engaña**: 60 por hora de 20 a 23 UTC parecía un cron de cada minuto, y se fue a buscar a `nutricion-tick` y `doer-flush`.
  Mirando los SEGUNDOS eran dos ráfagas por hora: a las :40 (`fathom-plan` → `plan-fathom`) y a las :52
  (`cs-sesiones-entrega`). Detalle en la entrada del Web Generator de este mismo día. Para saber quién llama hubo que
  deducirlo; el registro de la salud de cada clave guarda la `feature`.

**La regla que queda.** La salud de una clave se registra por su HUELLA (el sha-256 recortado, nunca la clave), con lo
que el PROVEEDOR contestó, y en su propio registro. `anthropic_usage` es el libro del gasto, no el de la salud.

**Lo medido (30 días, sólo lectura).** De 12 claves con algún 429, «24 h sin una respuesta buena y ≥ 10 rebotes» corta
dos (ws1 Gemini y ws1 Mistral, con 0 buenas y 46 rebotes) y ningún falso positivo. «12 h y ≥ 10» ya corta una del ws9
que se recuperaba sola. Detalle y decisiones en docs/diseno-ia-claves-caidas.md. · *2026-10-15 Automations*

## Quién sigue llamando a la Gemini muerta del ws1: dos crons por hora, y el rebote no dice quién (15/10/2026)

**Síntoma:** la key de Gemini del ws1 (Mauricio) no da un 200 desde el **08/10 a las 20:45 UTC** y acumula
**2.147 rebotes 429** al 15/10 04:52 UTC (491 el 09/10, 549 el 13/10, 498 el 14/10). Algo la sigue llamando.

**Por qué la base no lo contestaba:** `anotarRebote429` (lib/ia-cuotas.ts) escribe la fila del rebote con
`feature = 'cuota'` FIJO. Las 2.147 filas dicen 'cuota', y lo único que queda de quién llamó es el motivo,
«429 de gemini en la cuenta 1: chatCheap(gemini): HTTP 429». Tampoco hay filas vecinas: después del 429 el
resto de la cascada del ws1 falla sin dejar fila (Mistral 429, OpenAI sin crédito, OpenRouter nunca contestó),
así que ninguna fila con el feature verdadero cae en los mismos segundos.

⚠️ **El diagnóstico obvio era el equivocado.** «60 por hora» se leyó como «un cron de cada minuto», y así se
les reportó a dos sesiones. Mirando los SEGUNDOS de cada rebote son dos ráfagas por hora: una a las **:40**
(de 20 a 56 rebotes en tres minutos) y otra de **4 a las :52**. Cruzadas con `vercel.json`:

| Ráfaga | Cron | Qué hace |
|---|---|---|
| :40, sólo de 14 a 02 UTC | `40 14-23,0-2 * * *` → `/api/cron/fathom-plan` | `procesarReunionesNuevas` → `plan-fathom` (lee las reuniones de Fathom para el Plan) |
| :52, toda la noche | `52 * * * *` → `/api/cron/cs-sesiones-entrega` | `drenarSesionesEntrega` (lib/closing-entrega.ts) |

Las horas calzan exactas: los rebotes de las :40 aparecen sólo de 14 a 02 UTC, que es el horario del cron.
**Regla:** antes de deducir un ritmo de un conteo por hora, se miran los segundos. Un conteo agregado no
distingue «uno por minuto» de «una ráfaga por hora».

**Lo que cuesta:** el ws1 no sacó **ni un borrador** de sus reuniones desde el 08/10 (antes, 1 a 3 por día:
`plan_propuestas` con `ref` `fathom:*`). Y no es sólo un atraso: la reunión que falla no se marca, se
reintenta cada hora, y sale de la ventana de 26 h de `procesarReunionesNuevas` sin que nadie se entere. Ver
docs/hallazgos-plan.md, la entrada del 15/10.

**Y el 403 del 11/10 contra el 429 de hoy:** la entrada del 11/10 midió con un pedido directo un 403
`PERMISSION_DENIED` («Your project has been denied access»); lo que anota la cascada es `HTTP 429`. No se
volvió a medir: no se hacen llamadas con las keys de un cliente. Las dos cosas pueden ser ciertas a la vez
(otro endpoint, otro día), y para el ws1 da igual: no contesta.

**Sin hacer:** que el rebote guarde la función que llamó (lo toma Automations junto con el freno de claves
caídas, docs/diseno-ia-claves-caidas.md); cambiar la key del ws1 (lo decide Martín con Mauricio).
**Vive en:** lib/ia-cuotas.ts (`anotarRebote429`), lib/ai-cheap.ts (:613 y :1059, donde se anota),
app/api/cron/fathom-plan/route.ts, app/api/cron/cs-sesiones-entrega/route.ts.

## El Diagnóstico de una landing decía «no pude» sin la causa: `chatClaude` no le pasaba la red a la cascada (15/10/2026)

**Síntoma:** en el ws1, el Diagnóstico del Web Generator (y la tab Landing Analyst) contestaba el texto genérico de
fallo de IA, sin ninguna pista. `landing_analyses` guardó «Claude vetado — …» con 445 palabras leídas en el navegador.

⚠️ **El diagnóstico obvio era el equivocado**: ni el tamaño, ni un timeout, ni el JSON. Medido: el pedido armado con las
funciones de la casa son 2.405 tokens de entrada (`countTokens` de Gemini, que no gasta cuota), ~10.540 con los 8.000 de
salida: entra en todos los proveedores menos Groq gratis (8.000 por minuto). No hubo 413, ni timeout, ni JSON roto. Y
una sola llamada del mismo tamaño con la Gemini de la plataforma (ws9, cuenta 1, `gemini-flash-latest`) dio 200 en
72,4 s con el JSON entero.

**Causa:** al ws1 no le contesta ninguna de sus keys (la Gemini muerta desde el 08/10, arriba; Mistral 429, OpenAI sin
crédito, OpenRouter sin una respuesta buena, Groq salteado por tamaño). Y dos fallas nuestras lo tapaban:
- **`chatClaude` corría la cascada SIN red de plataforma**: la opción existía en `chatCheapCascade` y `chatClaude` no la
  pasaba, así que quien llamaba por `chatClaude` no la podía pedir.
- **Los errores de la cascada se quedaban adentro de `chatClaude`**: llegaba sólo «Claude vetado», y
  `diagnostico-server` lo traducía con `errorDeCascada([])`, la lista vacía. De ahí el texto genérico.
- Y la red no miraba el techo de entrada: Groq, salteado por tamaño, nunca entraba en `probados`, y `otroPrimero` lo
  ponía PRIMERO: dos 413 seguros antes de llegar a Gemini.

**Trampa del entorno:** el endpoint `runtime-logs` de la API de Vercel sólo transmite EN VIVO, no trae historial; y lo
que no es 200 ni 429 no queda en ninguna tabla (`anthropic_usage` sólo anota los 429, arriba). No se puede saber qué
contestó Gemini a las 04:19 UTC (no fue un 429). Desde `09613eebb`, los errores de las keys del negocio salen en
pantalla y los de la red van al log, nunca al texto.

**Lo que quedó:** `chatClaude` pasa `redDePlataforma`, `hastaMs`, los errores y `validar` a la cascada, y le devuelve al
que llama los errores de las keys del negocio. El Diagnóstico (las dos ramas, nuestra y de afuera) y la tab Landing
Analyst piden la red y un plazo de 250 s (la ruta tiene `maxDuration` 300); el uso queda en el Saldo de IA con el motivo
«⚠ red de plataforma». `analizarCopy` pasa `validar: analisisUsable`: un JSON que el parser de la casa
(`lib/json-del-modelo.ts`) no puede leer hace probar con la cuenta o el proveedor siguiente, en vez de llegar como
«Unexpected end of JSON input». Medido: ese parser TIRA con un JSON cortado a la mitad (no lo «repara» cerrando llaves),
así que un análisis truncado no pasa como completo. La copia ingenua de `parseJsonObject` que tenía
`lib/landing-analyst.ts` (la cuarta del repo) se borró. Y un 413 solo ya no dice «Prueba de nuevo»: dice que el pedido
es más largo de lo que acepta la IA gratis y que conecte Gemini (`esCascadaSinRespuesta`, `lib/ia-mensajes.ts`).

**Regla:** toda opción nueva de `chatCheapCascade` se pasa por `chatClaude`, o quien llama por ahí no la puede pedir; y
los errores de la cascada vuelven al que llama, que es quien arma el texto para la persona.

**Sin hacer:** el análisis tarda ~72 s con `flash-latest`; no se verificó en producción (la rama `web-t7` no estaba
desplegada al escribir esto).

**Vive en:** `lib/anthropic.ts` (`chatClaude`) · `lib/ai-cheap.ts` (la red y el techo de entrada) · `lib/landing-analyst.ts`
(`analizarCopy`, `analizarLanding` con `{ redDePlataforma, hastaMs }`, `analisisUsable`) ·
`lib/editor-landing/diagnostico-server.ts` · `app/api/landing-analyst/analyze/route.ts` · `lib/ia-mensajes.ts` ·
`tests/landing-analyst-red.test.ts` · *tanda 7 del Web Generator (`09613eebb`, `fd3bb3687`)*

## `gemini-flash-latest` dejó de aceptar `minimal`, y el error venía escondido en un ARRAY (15/10/2026)

**Síntoma.** A Joan (ws17, una sola key: Gemini) el chat de Automations le contestaba siempre «Falló de nuestro lado, no
de tus keys». Lo obvio era la red de plataforma (el chat no la tenía) o su key. Ninguna de las dos era la causa.

**Lo medido.**
- Una llamada por el mismo camino (`chatCheap`, `gemini-flash-latest`) dio HTTP 400 sin mensaje.
- El cuerpo, leído aparte: `[{ error: { code: 400, message: "Thinking level MINIMAL is not supported for this model",
  status: "INVALID_ARGUMENT" } }]`.
- `chatCheap` manda `reasoning_effort: 'minimal'` SIEMPRE a Gemini. Con `low`, 200.
- Con la key de la PLATAFORMA (ws9), lo mismo: no era la key de Joan.
- La última respuesta buena de `gemini-flash-latest` en cualquier negocio fue el 14/10 a las 20:31 UTC (ws11). Desde ahí
  contestó sólo el respaldo, `gemini-flash-lite-latest`, que sí acepta `minimal`.
- Le pegó a todo lo que cae en Gemini sin respaldo de modelo: el chat de Automations, closing-entrega y la propuesta de
  curso.

**Por qué no se vio.** Gemini manda el error en un ARRAY, y `chatCheap` (y otros cinco lectores de lib/ai-cheap.ts:
los documentos, las notas de voz y el cierre del doer) leía `data.error.message`: «HTTP 400» pelado. El clasificador
(`falloDeIA`) no lo reconoció y cayó a una frase que no decía nada. Y los 400 no quedan en `anthropic_usage` (sólo los
200 y los 429): el ws17 no tenía ni una fila.

**El arreglo.**
- `chatCheap`: el 400 del pensar reintenta UNA vez con `low` (con aire en el tope) y lo recuerda POR MODELO
  (`SIN_MINIMAL`, lib/gemini-esfuerzo.ts, memoria del proceso).
- Los seis lectores usan `leerErrorProveedor`.
- El chat de Automations tiene su red de plataforma.
- `falloDeIA` dice quién lo rechazó y qué contestó.
- Medido después: la key de Joan pasó el 400 y dio 503 (Google saturado), y el mensaje lo dijo así. La de la plataforma
  contestó «OK».

**La regla que queda** (en AGENTS.md): un modelo «latest» es un nombre que promete moverse. Lo que le mandamos puede
dejar de valer solo; el error tiene que llegar entero, y el parámetro tiene que poder caerse sin tirar el pedido.

**Sin hacer.** Ver si `lib/transcribe.ts` y `lib/embeddings.ts` (OpenAI, que manda objetos) necesitan
`leerErrorProveedor`. Y que un 400 de un proveedor también deje fila (docs/diseno-ia-claves-caidas.md, el registro).
· *2026-10-15 Automations*

## Que el cliente use SU Claude o su ChatGPT en vez de una API: qué se puede y qué no (15/10/2026)

**El pedido.** Martín, el 15/10: «quiero implementar esto en todos los workspace de los clientes, para que puedan
conectar sus cuentas de lo que sea, Claude, GPT, etc... Entonces deprecamos todas las "API gratuitas"». Su modelo
es el del Centro de Operaciones: Claude Code abierto en una PC, y MaKo mandándole pedidos.

**El diagnóstico obvio era el equivocado, dos veces.** Primero se contestó «Claude lo prohíbe» sin distinguir:
lo prohibido es que OTRA app use el token de la suscripción, no que el cliente corra el Claude Code oficial. Y
después se dio por hecho que «lo automático no lo cubre ninguna suscripción»: las routines de Claude Code en la
nube SÍ corren solas con la suscripción del cliente. Lo que de verdad decide es la cuota y la latencia, no el
mecanismo.

**Lo verificado en fuente primaria (15/10/2026, hora de Argentina):**

| Qué | Estado | Fuente |
|---|---|---|
| Usar el token OAuth de Pro/Max en otro software (lo de OpenClaw) | **Prohibido**, y se hace cumplir sin aviso | code.claude.com/docs/en/legal-and-compliance |
| Automatizar la CLI oficial (`claude -p`, `claude setup-token` para scripts) | **Permitido** como mecanismo; los topes suponen uso «ordinary, individual» | code.claude.com/docs/en/authentication · Consumer Terms (8/10/2025) |
| Alojar Claude Code del cliente en un servidor de MaKo | Permitido con condiciones: MaKo firma los Commercial Terms, binario sin tocar, login de Anthropic, MaKo no paga ni revende el uso | legal-and-compliance |
| Routines (Claude Code en la nube del cliente) | Permitido; disparo por API (`POST /fire`): **30/h por routine y 100/h por cuenta**, horario mínimo 1 h, arranque en frío (latencia no publicada) | code.claude.com/docs/en/routines (research preview) |
| Que MaKo le dé órdenes 24/7 al Claude Code del cliente para atender leads | **Zona gris**: se parece a «enrutar pedidos por credenciales del plan en nombre de los usuarios». La página manda a consultar a ventas | legal-and-compliance |
| Topes de Pro/Max | Ventana de 5 h y semanal, compartidas con el uso del dueño; **sin números publicados**; al tocarlos, corta | support.claude.com/en/articles/11145838 |
| Crédito de API incluido en Max 5x / 20x | **US$100 / US$200 por mes**, con una API key de Console vinculada; al acabarse corta, no cobra | platform.claude.com/docs/en/about-claude/api-credits-for-subscribers |
| «Use your ChatGPT plan» en apps de terceros | Sólo socios y apps de código abierto (lista de espera); sin audio, transcripción ni imágenes generadas | developers.openai.com/siwc/quickstart · DevDay 29/09/2026 |
| Usage Policy de Anthropic | Un bot que le habla a gente de afuera dice que es una IA al empezar cada chat | anthropic.com/legal/aup |

**Lo que ninguna suscripción de chat cubre:** transcripción, voz, generación de imagen o video, embeddings
(Anthropic recomienda Voyage). Entender una imagen (una captura) sí entra.

**La regla que queda:**
1. MaKo **nunca** toca el token de la suscripción de un cliente: ni lo guarda, ni lo usa, ni ofrece «Iniciar sesión
   con Claude» en su pantalla.
2. Lo que SÍ se puede ya: MaKo como herramienta (MCP / la API de MaKo) **dentro** del Claude o del ChatGPT del
   cliente, y el crédito de API de Max cargado como clave propia en el BYOK que ya existe.
3. Lo que necesita respuesta en vivo (un lead que escribe por WhatsApp) no se apoya en una suscripción: cuota sin
   números, compartida con el dueño y que corta en silencio. Siempre con respaldo de API.
4. Antes de construir «MaKo le da órdenes al Claude Code del cliente las 24 horas», preguntarle a ventas de Anthropic.

**Vive en:** la decisión, en la Ticketera (`clientes-conectan-su-ia`); la memoria `ia-del-cliente-suscripcion`; el
BYOK en `lib/credenciales.ts` y `/integraciones`.
· *2026-10-15 Estrategia 3 cuentas*

## El mapa de la IA: qué corre solo 24/7 y qué es conversado (16/10/2026)

Para la decisión A de Martín (el cliente usa su Claude/ChatGPT para lo conversado; lo que corre solo, con API) se mapeó TODO lo que usa IA: **docs/mapa-ia-24h.md** (108 funciones: 28 corren solas, 68 son conversadas o de un clic, 16 son medios).

**Lo que no se veía y cambia prioridades:**
- **El AI Step (le contesta al lead) usa SÓLO las keys del negocio y no tiene red de plataforma.** Un negocio sin key propia deja al lead sin respuesta. Es el primer lugar donde un usuario nuevo sin API se queda sin nada.
- **El AI Step no escucha las notas de voz del lead:** le llega texto vacío. De una imagen sólo ve el pie de foto.
- **Que el código diga «Claude» no quiere decir que use Claude:** sólo el Closing Analyst paga Claude Sonnet; el resto va por la cascada barata.
- **Dependen sólo de OpenAI, sin alternativa:** la transcripción y lectura de los anuncios, la búsqueda en la metodología (embeddings, con la key de la plataforma: si falla, MaKo contesta sin la metodología y nadie se entera) y mirar los creativos.

**Vive en:** docs/mapa-ia-24h.md (con su lista de lo que quedó sin revisar a fondo).
· *2026-10-16 Estrategia 3 cuentas*


## La clave de Anthropic del negocio: la segunda puerta del veto (16/10/2026)

**Vive en:** `lib/veto-claude.ts` (`evaluarClaveDelNegocio`, `FEATURES_DEL_PLAN`) · `lib/anthropic.ts`
(`conClaveDelNegocio`) · `lib/ai-cheap.ts` (el primer intento de `chatCheapCascade`) ·
`tests/veto-claude-clave-negocio.test.ts`

**El diagnóstico obvio era el equivocado.** «Que el cliente cargue su crédito de Max como clave de Anthropic y MaKo lo
usa» suena completo y no lo era: desde el veto del 13/08 la clave de Anthropic de un negocio la usaba UNA feature, el
análisis de llamadas de cierre. Y la ficha de /integraciones decía «el cerebro de MaKo: análisis, chats, sugerencias y
todos los Analysts», falso desde agosto para cualquiera. El veto era sobre la plata de MaKo; la del negocio no tenía
puerta.

**La trampa que hacía peligrosa la puerta nueva: `credWs` no contesta «¿cuál es la clave del negocio?».** Para el
workspace del dueño cae al env de la plataforma, y `migrarEnvACredenciales` siembra la fila del dueño desde ese mismo
env. Con `credWs`, el ws1 (un cliente) habría usado la clave de la plataforma como si fuera suya, por la puerta que no
tiene lista blanca. Por eso la clave se lee con `credDelCliente` (sólo la fila), se compara contra las tres copias de
la plataforma leídas estrictas, y el permiso lleva adentro la clave verificada: el `fetch` no resuelve otra.

**Y una trampa de los tests que leen fuente, medida en la misma tanda:** un `sinComentarios` que borra las líneas que
empiezan con `*` ANTES de recortar los bloques se lleva también los ` */` que cierran cada JSDoc, y el recorte de
bloques queda abierto hasta el próximo cierre. Sobre `lib/ai-cheap.ts` entero se comía `chatCheapCascade` completa, y
el test contestaba «no encuentro la función». Lo que sirve es líneas `//` primero y bloques después, nada más (el orden
que ya pide AGENTS.md). El de `tests/onboarding-red-plataforma.test.ts` tenía el mismo paso y no mordía porque se
aplica a una función ya recortada; se corrigió igual.

### Lo que quedó SIN hacer

- **Las funciones del Plan quedan afuera aunque la clave sea del negocio** (`FEATURES_DEL_PLAN`), por la regla de
  Martín del 30/09 («JAMÁS algo pago para el plan»). Es una lista negativa a propósito y se dice: una feature del Plan
  nueva que no se sume ahí usaría el crédito del negocio.
- **Sólo la cascada de texto.** La visión (`leerDocumentoIA`), el audio y el loop con herramientas (`chatCheapTools`,
  el doer) no prueban la clave del negocio.
- **El gasto se registra con la marca «⚠ clave de Anthropic del negocio» AL PRINCIPIO del motivo** (`insertUsage`
  corta a 200 y al final se perdía) y en el workspace del negocio (`wsDeProveedor`). De los lectores de
  `anthropic_usage`, el único que lo sumaba como gasto de MaKo era `resumenDelPeriodo` (lib/costos-ia.ts, el global
  del super admin): ahora lo saca del total y lo muestra aparte en /integraciones. El panel de cada negocio y el
  Dashboard leen sólo su workspace, y ahí ese gasto SÍ es suyo. El aviso «saldo de IA bajo» no está implementado.
- **Sin probar contra Anthropic de verdad**: no había una clave de negocio para hacerlo. El primer cliente que cargue
  la suya es la prueba, y la fila de `anthropic_usage` con ese motivo es la forma de verlo.

· *2026-10-16 chat «Onboarding» (claude3), por pedido del coordinador sobre la decisión de Martín*

## La red de la plataforma para la primera semana de un cliente sin API (16/10/2026)

**Vive en:** `lib/razones.ts` · `lib/ads-analyst.ts` · `lib/offer-ia.ts` · `lib/archivo-a-texto.ts` ·
`lib/editor-landing/ia.ts` · `lib/flujo-ia-crear.ts` · `app/api/second-brain/buscar/route.ts` ·
`app/api/onboarding/archivero/route.ts` · `tests/red-primera-semana.test.ts`

Desde el 15/10 un cliente nuevo no trae una API, y lo primero que toca después del wizard le contestaba «conecta tu
IA». Se extendió la red a Ads Writer, Offer, crear una landing, crear una automatización y la búsqueda del Second
Brain, en ese orden, de a uno y con un test cada uno.

**La capacidad, medida antes (sólo lectura, últimos 14 días):**

| Qué | Número |
|---|---|
| Keys gratis de la plataforma (ws9) | 3 de Gemini y 2 de Groq |
| La key de Gemini con más pedidos en un día | 29, contra un tope de 250 cada una |
| Groq | de 1 a 4 pedidos por día |
| Rechazos por cuota (429) de esas keys | 194 el 13/10, todos del propio ws9 (159 entre las 16 y las 18 UTC) |
| Lo que usa un cliente nuevo en su primera semana | de 5 a 58 llamadas en total; los cuatro últimos, de 5 a 11 |

Con 10 clientes nuevos en la misma semana son menos de ~100 pedidos por día contra ~750: **por día alcanza**. Lo que
muerde es el tope POR MINUTO, y lo pisa el uso del propio ws9 de Martín, que comparte esas keys. Y la red es UN
proveedor de verdad (Gemini; Groq no entra con prompts de más de ~7.000 tokens): el 14/10, cuando Google cambió
`gemini-flash-latest`, estuvo caída para todos.

**El diagnóstico obvio era el equivocado, y lo cometí yo:** «la red está escrita» no es «la red corre». El Archivero
tenía tres cortes `if (!(await docsIADisponible()))` que devolvían «Carga tu API key de Gemini» ANTES de llamar a la
IA, Offer uno en `pedir`, y la API de MaKo otro en `hayIAParaCrear`. Con el paso de la IA del wizard ya opcional
(7f0ced90f, en main), un cliente sin keys se trababa en El Archivero, que es bloqueante; el test de ese commit daba
verde porque sólo miraba que la red estuviera escrita. La regla quedó en AGENTS.md (la red de plataforma: «y nada la
corta antes») y los tests ahora preguntan qué hay antes de la llamada.

### Lo que quedó SIN hacer

- **El análisis del lead se resolvió con una regla** (el coordinador, el mismo día): los datos de los clientes de un
  cliente nunca van a un proveedor que entrena con lo que recibe. Va con red, pero en `chatCheapCascade` un pedido con
  la marca `pii` del catálogo usa sólo el crédito de Claude de la plataforma y se corta antes de las keys gratis
  (`7068a0903`; la regla en AGENTS.md). El ws9 tiene un crédito de Gemini de US$10 cargado el 22/07
  (`saldo.gemini`), pero la base no dice a cuál de las tres keys corresponde: «la key de Gemini con facturación» del
  orden de la red queda sin usar hasta que alguien la identifique en Google Cloud.
- **Y el corte tampoco miraba las keys «del negocio» que son copias de la plataforma**: la del ws1 lo era. Cerrado el
  mismo día en `provsDe` (ver «La key de la plataforma copiada en la fila de un cliente», más abajo).
- **Los caminos con su PROPIA red (un bucle sobre `provsGratisDePlataforma`, no la cascada) no tienen ese corte**, y
  algunos llevan datos de clientes: el doer de WhatsApp (`lib/mako-doer-in.ts`; `mako-doer-in` es `pii` en el
  catálogo), los gráficos con IA (`lib/graficos-ia-red.ts`; `dashboard-conclusiones` es `pii`), la transcripción de
  audio (`transcribirAudio`) y el guion de audio de Automations (`app/api/chat-agent/redactar`). Son de otras áreas: la
  regla de AGENTS.md les pide aplicarla ellos mismos.
  (17/10: el doer ya corta, ver «La red gratis del doer de WhatsApp y los datos de clientes», más abajo; los gráficos
  y el audio también, `red gratis salteada`. El guion de Automations sigue sin el corte.)
- **Las otras ~50 llamadas sin red** siguen sin ella: el coordinador decide el orden sobre `docs/mapa-ia-24h.md`.
  Segunda tanda, el mismo día y sin datos de clientes (red gratis): el diagnóstico de una landing (ya la tenía desde el
  15/10; ahora con test de punta a punta), importar un archivo para armar la landing, carruseles/reels/stories
  (`generarPieza`) y planificar el anuncio en video (el plan y la reparación de su JSON). Las lecturas del CRM con
  datos de clientes (contrato, comprobante, documento fiscal) siguen sin red, y sin key ya dicen qué conectar: «Carga
  una API key de Gemini u OpenAI en Integraciones», que es lo correcto porque la lectura por visión no usa Claude.
- **Ningún camino se probó contra la red de verdad con un workspace sin keys**: sin `next dev` por la RAM.

· *2026-10-16 chat «Onboarding» (claude3)*

## El crédito de Claude Max de la plataforma: la tercera puerta del veto (16/10/2026)

**Vive en:** `lib/veto-claude.ts` (`evaluarCreditoDeLaPlataforma`, `CLAVES_CREDITO_PLATAFORMA`) · `lib/anthropic.ts`
(`conCreditoDeLaPlataforma`) · `lib/ai-cheap.ts` (la red de plataforma) · `lib/anthropic-usage.ts` (`recordUsage(…, ws)`)
· `lib/costos-ia.ts` · `scripts/credito-claude-a-plataforma.mts` · `tests/veto-claude-credito-plataforma.test.ts`

Martín vinculó el crédito de API de dos planes Max suyos (US$200 por mes cada uno; «Vinculalas a MaKo»). El código lo
usa primero en la red de plataforma, antes de las keys gratis, por lo medido el mismo día: las gratis alcanzan por día
pero chocan por minuto con el uso del ws9, el crédito vence cada mes sin acumularse, y la API de Anthropic no entrena
con lo que recibe (el plan gratis de Gemini sí). Un cliente nuevo usa de 5 a 58 llamadas en su primera semana: unos
pocos dólares contra 400 por mes.

**Dos trampas que se cazaron escribiéndolo:**
- **`wsDeProveedor` manda una fila de Anthropic al ws1 cuando el workspace no tiene clave propia**, que es justo el
  caso del crédito: Mauricio (un cliente) habría visto un gasto de Claude que no es suyo. `recordUsage` acepta ahora el
  workspace explícito, y el crédito anota en el del cliente que lo usó.
- **El test que buscaba «la fila va al ws del cliente» daba verde con una de las dos filas sin el ws**: encontraba la
  otra. Ahora exige que TODAS lo lleven.

### Lo que quedó SIN hacer

- **Las claves no están activas en producción.** Viven en el `.env.local` del clon; en Vercel no se pudieron cargar (el
  usuario de la CLI es Developer). Hay dos caminos: Martín las carga en Vercel con el rol de dueño, o se corre
  `scripts/credito-claude-a-plataforma.mts`, que las guarda cifradas en la fila del ws de la plataforma. El script
  escribe en producción y espera el OK de Martín.
- **Si una de esas organizaciones de Console tiene crédito comprado o auto-recarga, al acabarse el incluido sigue
  cobrando** (lo dice la página de Anthropic). No se puede ver desde acá: lo revisa Martín en platform.claude.com.
- Sólo la cascada de texto: ni visión, ni audio, ni el doer.

### Y el mismo día: el crédito, SÓLO en el onboarding

Martín, textual: «Sobre esto: "usando sólo el crédito de Claude", no, no lo hagas así... Yo debo decirte cuando
utilizar creditos, no tenemos infinitos... Por ahora solo en onboarding.» En pocas horas tres caminos se habían
enchufado solos al crédito (el AI Step, las Conclusiones del Dashboard y el análisis del lead), cada uno con un buen
argumento, y ninguno lo había pedido él. **Un recurso que cuesta y se acaba no se habilita desde el que lo usa: se
habilita en una lista, en el que lo da.** Desde ahí `CREDITO_HABILITADO_PARA` (lib/veto-claude.ts) es la única
compuerta: hoy El Archivero, la extracción del brief y Productos, mientras el onboarding del negocio está en curso
(`onboardingPendiente`, lo mismo que decide si va al wizard). Los otros tres reciben null de `conCreditoDeLaPlataforma`
sin tocar su código, y su cascada sigue como antes: con datos de clientes, sin nada gratis que entrene. Para el análisis
del lead eso es «sin IA propia, no hay análisis», y el mensaje pasó de «El análisis falló: Claude vetado…» a decir que
conecte su Claude. Probado rompiéndolo: cinco roturas, cinco cazadas.

**Y la cuenta 2 como el Claude PROPIO de Leandro (ws10)**, por pedido de Martín («que cada usuario traiga sus cuentas
de GPT o Claude... Vinculalo para el caso de Leandro también»): `scripts/claude-propio-de-un-negocio.mts` la guarda como
la `ANTHROPIC_API_KEY` del negocio con el mismo `guardarCredencial` de /integraciones. Sólo acepta como origen una de
las claves del crédito, se niega con el ws de la plataforma y el del dueño, no pisa una clave distinta y relee. La cuenta
2 sigue de reserva en el crédito del onboarding, detrás de la 1. ⚠️ Los dos scripts leen el `.env.local` del
directorio desde el que se corren: van desde el clon (que lo tiene) y con el código ya en main, no desde un worktree.

· *2026-10-16 chat «Onboarding» (claude3)*

### Qué deja leer Anthropic del crédito de los planes Max, y quién más lo gasta (22/10/2026)

Para la sección «API» del Uso del Ops Center (Martín: «quiero ver también el USO de la API... deberían ser 800 usd al mes»).
Medido con las dos claves del crédito, sólo con lecturas (`GET`):
- **`/v1/organizations/cost_report` y `/v1/organizations/usage_report/messages` contestan 401**: «The Admin API requires an
  Admin API key or an organization-scoped API key». Las organizaciones del crédito son «Individual Org», y la Admin API no
  existe para cuentas individuales (platform.claude.com/docs/en/manage-claude/usage-cost-api). Para leer el costo desde acá
  haría falta convertir cada una en organización (Console → Organization) y crear una Admin key (`sk-ant-admin01-…`) por
  organización. **El saldo no tiene endpoint**: se ve sólo en platform.claude.com → Billing → Promotional credits, con el
  monto y el vencimiento.
- **Lo que sí contesta una clave común es `/v1/organizations/me`**: el nombre de su organización. Así se verificó qué clave
  es de qué plan: la CUENTA1 es «Mauricio's Individual Org» (claude1) y la CUENTA2, «Lean's Individual Org» (claude2).
- **El crédito llega con cada cobro del plan, no el 1 del mes**; el tope de gasto de la organización sí se reinicia el 1.
  MaKo no sabe el día de cobro de ningún plan.

**El diagnóstico obvio («sumar las filas con la marca del crédito») se queda corto.** El ws10 tiene como su
`ANTHROPIC_API_KEY` la clave del crédito de la cuenta 2 (scripts/claude-propio-de-un-negocio.mts). Todo lo que ese negocio
paga con «su» Claude sale del mismo crédito y sus filas NO llevan la marca: llevan la del negocio o ninguna. Por eso
lib/credito-api-db.ts descifra las `ANTHROPIC_API_KEY` de los negocios y las compara con las del crédito. Ni el ws de la
plataforma ni el del dueño entran: ahí caen filas de varias claves (`wsDeLaFila`). En octubre (al 22): cuenta 1, US$0,25 en
47 llamadas, todo del onboarding; cuenta 2, US$0, y el ws10 tampoco gastó.

**Regla:** una clave que comparten la plataforma y un negocio se cuenta por la CLAVE, no por la marca del motivo. Y un número
que Anthropic no deja leer se dice «lo que registra MaKo», con el link a donde está el real.

## Los pedidos sueltos en los chats: las palabras de un área no rutean, y un plazo corto a la cascada no corre nada (16/10/2026)

**Vive en:** `lib/mako-pedidos.ts` (`decidir`, `PARTES_DE_LO_ABIERTO`, `RE_VERBOS`, `CONECTOR`) · `lib/mako-pedidos-ia.ts`
(`PLAZO_MS`, `MIN_INTENTO_CASCADA_MS`) · `app/api/mako/pedidos/route.ts` (`objetosDeTab`) · `lib/mako-intencion.ts`
(`AREA_KEYWORDS`) · `lib/ai-cheap.ts` (`MIN_INTENTO_MS`) · `tests/mako-pedidos.test.ts` · el diseño en
`docs/diseno-mako-pedidos.md`

El módulo que separa un mensaje del chat en pedidos (lo abierto / otro objeto de la tab / uno nuevo / otra tab) se
apoyó en lo que ya había. Cuatro de esas piezas no servían como parecían:

- **`AREA_KEYWORDS` sirve para SUMAR herramientas, no para RUTEAR.** Es ancha a propósito (sobrar una herramienta es
  barato), y en el chat del Web Generator «cambia el precio» nombra `negocio`, «quita el video» nombra `video` y «un
  formulario para leads» nombra `crm`: los tres son cambios de la landing abierta. Si «nombra otra área» mandara a otra
  tab, el chat dejaba un link en vez de editar. La regla: otra tab sólo si el verbo CREA un objeto de esa área (su
  objeto directo: «agéndame una REUNIÓN»), si no hay nada abierto, o si lo etiquetó la IA (validada). Lo demás va a lo
  abierto y cuenta como duda, así que entra la IA.
- **«Página» es del área `landing`, pero dentro del Web Generator es una PARTE de lo abierto.** Un sitio tiene páginas
  («Añadir página», `PanelPaginas.tsx`): «crea otra página con los testimonios» salía como una landing NUEVA, «borra la
  otra página» elegía otra landing para la Papelera y «elimina esta página» decía «usa ⋯ › Eliminar» de la landing.
  Lo cazó la revisión, no un test. Una palabra de un área que dentro de su tab nombra una parte va a
  `PARTES_DE_LO_ABIERTO`; fuera de su tab sigue contando («créame otra página» en Automations va al Web Generator).
  ⚠️ **Y la primera versión de la regla también estaba mal: era por ÁREA, y es por TAB.** Al sumar el Image Editor,
  «crea otra página» en un diseño se iba al Web Generator: «página» es palabra de `landing` (otra área), y un diseño
  tiene páginas como en Canva. Lo mismo «otro gráfico» en el Dashboard (no es otra hoja) y «el otro clip» en el Video
  Editor (no es otro proyecto). `PARTES_DE_LO_ABIERTO` va por la tab donde se dice, con palabras de cualquier área, y
  gana aunque la IA etiquete la otra área. ⚠️ **General es el caso extremo (16/10, al enchufar su «Editar con MaKo»)**:
  sus bloques son VISTAS de otras tabs (tareas y proyectos del Plan, cobros, KPIs, la agenda: lib/general-piezas.ts),
  así que casi todas sus partes son palabras de OTRA área. «Agrega un bloque de tareas» mandaba al Plan, y «tareas» es
  justo lo que la IA etiqueta como `plan`. La lista de General es larga a propósito; una tab que muestra piezas de
  otras tiene que nombrarlas todas ahí (está en tests/dashboard-pedidos-chat.test.ts, también con `origen: 'ia'`).
  gana aunque la IA etiquete la otra área.

- **Y al revés: una palabra de OTRA área que, dentro de una tab, nombra OTRO objeto de esa tab.** El Video Editor
  llama «proyecto» a cada video (como CapCut, y su inicio lista proyectos), y «proyecto» es palabra de `plan`: al
  enganchar su chat (16/10), «créame otro proyecto» contestaba «Eso se hace en Plan» y «borra el otro proyecto» no
  era «el otro». `OBJETOS_DE_LA_TAB` es la otra cara de `PARTES_DE_LO_ABIERTO`: el objeto directo con esa palabra, o
  un pedido que nombra esa área SÓLO con esa palabra, son de esta tab; fuera de su tab sigue siendo del Plan
  (tests/video-editor-pedidos-chat.test.ts, prueba 6b).


- **Los objetos del Video Editor no se pueden listar en el servidor**: sus proyectos viven en IndexedDB (decisión 5 de
  su diseño). Para esa tab, y sólo para ella (`TABS_CON_OBJETOS_EN_EL_NAVEGADOR`), la lista la manda su chat y la ruta
  la valida (`objetosDelNavegador`). Y las hojas del Dashboard son POR PERSONA: los objetos son las del informe de quien
  mira, y quien nunca guardó uno ve la pantalla sin páginas, así que su lista es [] y no las del inicial.
- **⚠️ `chatCheapCascade` NO SIRVE para un plazo de segundos, y el arreglo que dejé primero acá estaba MAL.** No
  arranca un intento si al plazo le quedan menos de 15 s (`MIN_INTENTO_MS`), así que con `hastaMs = ahora + 7 s` no
  prueba nada. El «arreglo» fue `hastaMs = inicio + 15 s + una ventana de 3 s para arrancar`, y en producción la IA
  **no corrió NUNCA**: antes del primer proveedor la cascada lee las cuotas del día de la base y prueba la clave de
  Anthropic del negocio (1,3 s en ws9, que no tiene), y ese preámbulo (~3 s) se comía la ventana entera: «sin tiempo:
  el plazo del pedido vence en 15 s», 0 filas de `mako-pedidos` en `anthropic_usage`, y el chat esperaba 5-9 s por
  nada. Los tests no lo veían porque la IA era un doble. Lo cazó mirarlo con clics y la tabla de uso. Ahora: un bucle
  propio (`probarEnOrden`, con un test de reloj falso), las keys del negocio en NUESTRO orden. Para cualquier plazo de
  segundos, lo mismo: la cascada no.
- **Y el orden importa más que la rotación: Groq primero.** Medido en ws9 con el prompt real: Groq
  (`openai/gpt-oss-120b`) 1,4 s; Gemini `flash-latest` 10,9 s y `flash-lite-latest` 6,6 s (desde el 14/10 no acepta
  pensar `minimal`, corre en `low`), y a veces «high demand». Con Gemini primero y 3 cuentas, su intento se comía el
  plazo. Con el arreglo: 3-5,5 s de punta a punta, y etiqueta bien lo que las reglas solas pierden («quita el video
  del hero y agéndame una reunión con Juan» → lo abierto + CRM).
- **`MODELO_DOCS.openrouter` (`minimax/minimax-m3:free`) ya no existe** («This model is unavailable for free», medido
  el 16/10): el respaldo de OpenRouter de toda la cascada barata está muerto. Vive en `lib/ai-cheap.ts`; no se tocó.
- El navegador espera más que la IA (12 s contra 7,5 s): la ruta antes lee la sesión, la vista y los objetos, y con
  10 s contra 9 s el chat cortaba justo cuando la IA contestaba.
- **Desde el 16/10, `redDePlataforma` es pedir Claude**: esa red prueba PRIMERO el crédito de Claude de la plataforma
  (la tercera puerta, más arriba). Una feature que no puede usar Claude no la pide: va su propia red con
  `provsGratisDePlataforma`, como Offer, y con `pii` no corre.

Dos trampas de las reglas, chicas pero que cuestan una llamada a la IA en cada mensaje: «qué tengo» como verbo de ver
hacía de «la otra automatización QUE TENGO» un segundo verbo (y las reglas dudaban); y «y + verbo» no separa pedidos:
«crea otra landing y ponle el título X» es UNO sobre la landing nueva, partido mandaba el título a la abierta.

Y `linkPantalla` (lib/api-mako/link.ts) no sirve para un link de ADENTRO de la app: importa `lib/workspace`
(server-only) y arma el absoluto de los que salen. Adentro, `conWs` (lib/ws-tab.ts, isomórfico).

### Lo que quedó SIN hacer

- **La clave PROPIA de Anthropic del negocio todavía puede contestar** dentro de la cascada (la segunda puerta): es su
  plata y su decisión. Cerrarla del todo pide una opción en `chatCheapCascade` (lib/ai-cheap.ts). Decide el coordinador.
- **Automations**: su función en `objetosDeTab` (app/api/mako/pedidos/route.ts) y el fetch en su chat; hasta entonces,
  «la otra automatización» contesta «¿Cuál? Dime su nombre.». **El chat único del Second Brain**, lo mismo. Image
  Editor y Video Editor ya tienen sus objetos (16/10), pero sus chats todavía no llaman a la ruta: el del Video Editor
  tiene que mandar `objetos` (cómo, en docs/diseno-mako-pedidos.md). El Dashboard y General ya llaman (16/10, chat
  «Dashboard»: `app/dashboard/pedidos-hoja.ts`).
- **Correr la operación de OTRA tab desde la burbuja**: hoy deja el link (y la operación como dato).
- **No se probó con la IA de verdad ni en el navegador** (sin `next dev` por la RAM): las reglas y la IA con un doble.

· *2026-10-16 chat «Web Generator» (claude3)*

### Probado con la IA de verdad en el ws9, desde «Editar con MaKo» del Dashboard (17/10/2026)

Sólo leyendo: el código de la ruta (`interpretarMensaje` con las hojas del informe guardado del ws9, «CRM y pipeline» y
«Landing», y las operaciones que ve un admin) y las burbujas del panel (`burbujasDeHoja`), sin apretar nada. Andan
**crear otra hoja** («¿Armo otra hoja con…?», 3 s por la IA), **el compuesto** («Agrega los leads por semana y después
créame otra hoja de anuncios»: lo primero a la hoja abierta y «¿Terminamos esto y después…?») y **«Quiero ver mis leads
en el CRM»** (el link a /crm). Tres fallas, todas en lib/mako-pedidos.ts:

1. **Una hoja que se llama como una tab no se abre.** «Abre la hoja Landing» y «Archiva la hoja Landing» contestan «Eso
   se hace en Web Generator» con su link: la palabra del área le gana al nombre exacto de un objeto de ESTA tab.
2. **Los verbos de ir no existen.** «Ve al CRM», «Llévame al CRM» y «Llévame a la tab de General» no tienen verbo en
   `RE_VERBOS` (sólo «ver», «mira», «muestra»…), así que `dudaDeLasReglas` no duda, las reglas los resuelven en 0 s y van
   ENTEROS a editar la hoja abierta (a `/api/graficos/editar`, que contesta que no cambió nada).
3. **Una hoja que no existe va a la hoja abierta.** «Abre la hoja de Marketing» (no hay ninguna) sale por reglas como un
   cambio de la hoja abierta, en vez de «No hay una hoja «Marketing»» con las que hay.

El script, fuera del repo: `probar-pedidos-ws9.mts` en el scratchpad del chat «Dashboard» (cuenta 4); se rehace con
`objetosDeTab` + `interpretarMensaje` + `burbujasDeHoja` bajo `runWithWorkspace(9)` y `--conditions=react-server`.
· *2026-10-17 chat «Dashboard» (claude4)*

### Las tres, cerradas en las reglas (17/10/2026, chat «Automations»)

- **«Abre la hoja Landing» no era culpa de la IA.** Las reglas solas acertaban; lo que fallaba era que DUDABAN («Landing» es
  palabra del área `landing`, así que el texto «nombraba dos áreas»), le preguntaban a la IA, la IA decía `landing` y una
  etiqueta de la IA gana siempre. El diagnóstico obvio («que la IA etiquete mejor») no lo arreglaba. Ahora un área que el
  texto nombra SÓLO dentro del nombre de un objeto de esta tab no cuenta: ni para dudar (`areasFueraDeNombres`) ni para
  mandar a otra tab (`enUnNombre`, aunque la IA lo diga). ⚠️ Con una excepción que el primer intento rompió: «créame OTRA
  landing» con una hoja llamada «Landing» es una landing, no la hoja (`unaDeEsaArea`).
- **«Ve al CRM» no tenía ni verbo ni área.** «CRM» y «General» no son palabras de su área en `AREA_KEYWORDS` (esa tabla se
  hizo para sumar herramientas: no tiene los nombres de las tabs). Los verbos de ir NO van en `RE_VERBOS`: «vamos a crear
  otra landing» es crear y «cuando el lead entra al funnel» describe una automatización. Cuentan sólo con un destino que se
  reconoce (`destinoEn`): el TÍTULO de la tab (`AREA_INFO[*].tab`, con «la tab de», «la pestaña de») o, después de «ve a»
  y «llévame a», una palabra del área que no sea un verbo («vamos a agendar» sigue siendo agendar, con su operación). A la
  misma tab por su título: «Ya estás en Dashboard.». «A y llévame al CRM» se parte, para que el link no se coma el cambio.
  ⚠️ Una regex sobre el texto PLANO que escribe «llevame» la agarra la guarda de voseo de tests/puente-panel-copy.test.ts
  (que no nombra este archivo: corre sobre todo el repo). Se escribe `llev(?:ame|anos)`, como `agend(?:ar|ame)` al lado.
- **«Abre la hoja de Marketing» (no existe) ahora dice «No hay una hoja «Marketing». Están «A» y «B».».** Es
  `PALABRA_DEL_OBJETO` por tab (hoja, landing, automatización, diseño, proyecto), sólo con ver/abrir y borrar, y sólo si la
  tab conoce sus objetos (con la lista vacía no se sabe si no hay o si no se leyeron). Un nombre con «y» adentro
  («CRM y pipeline») se busca ENTERO antes de cortar el nombre en la «y». La hoja abierta pedida por su nombre: «ya está
  abierta» (antes la burbuja no decía nada).

**Lo que quedó SIN hacer:** la burbuja de «Ve al CRM» dice «Eso se hace en CRM.» con su link: el texto es de cada chat
(`TEXTOS_HOJA.irA` en app/dashboard/pedidos-hoja.ts) y `PedidoResuelto` no distingue «ir» de «hacer». «Quiero ver mis
leads en el CRM» sigue dependiendo de la IA (las reglas lo mandan a la hoja; «en el CRM» no es un destino). No se probó con
la IA de verdad ni en pantalla.

**Vive en:** `lib/mako-pedidos.ts` (`destinoEn`, `areasFueraDeNombres`, `porSuPalabra`, `noHay`, `decidir`,
`dudaDeLasReglas`) · test: `tests/mako-pedidos.test.ts` (los tres del 17/10, probados rompiéndolo).
· *2026-10-17 chat «Automations» (claude4)*

## La key de la plataforma copiada en la fila de un cliente: los datos del ws1 iban a un Gemini gratis (16/10/2026)

**Vive en:** lib/ai-cheap.ts (`provsDe`, `provDe`, `soloLasPropias`, `huellasDeLaPlataforma`) · lib/ia-keys.ts
(`sinCopiasDeLaPlataforma`)

El Centro de Operaciones vio, sin medir, que el turno con herramientas (`chatCheapToolsCascade`) le daba al ws1
(Mauricio, un cliente) la key de IA de la PLATAFORMA, y que esa cascada no tiene el corte por datos de clientes.

**Lo medido** (sólo lectura, comparando huellas sha256, sin imprimir ninguna key): la `GEMINI_API_KEY` de la FILA del
ws1 es la MISMA que una de la plataforma, y su `OPENAI_API_KEY` también; Groq, Mistral y OpenRouter sí son suyas.

**El diagnóstico obvio era el equivocado.** Se sospechaba de `credWs`, que al ws1 le presta la key del ENTORNO cuando
no tiene la fila. Pero la fila existe: es una COPIA. Por eso el arreglo no podía ser sólo «leer con `credDelCliente`»
(que se hizo igual: `provDe` ya no usa `credWs`). Y el agujero no era de la cascada con herramientas: era de TODAS.
Cada cascada prueba primero las keys «del negocio» (`provsDe`), y el corte por datos de clientes miraba sólo la red
de la plataforma. Así, el análisis del lead, las notas de voz, el doer y el turno con herramientas del ws1 mandaban
datos de SUS clientes a la key gratis de la agencia, que entrena con lo que recibe.

**La regla** (la misma que ya valía para la clave de Anthropic del negocio y para la de Resend): una key de la
plataforma copiada en la fila de un cliente sigue siendo de la plataforma. `provsDe` saca de las «propias» toda key
cuya huella coincide con una de la plataforma (las de su workspace y las del entorno). Fuera de ahí, la de la
plataforma sólo entra por la red, que es la que corta con datos de clientes. Es un punto único: texto, herramientas,
documentos, audio y el doer pasan por ahí. El workspace de la plataforma usa las suyas tal cual. Si las huellas no se
pueden leer, no se arriesga ninguna (fail-closed). La caché es de proceso y guarda huellas, nunca keys. Lo fija
`tests/ia-keys-propias.test.ts`, probado rompiéndolo (ocho roturas, todas caen).

**Lo que cambia para el ws1:** sin datos de clientes, lo que antes corría con esa copia ahora corre con sus keys
propias, y si fallan, con la red (la misma key de la plataforma, registrada como red). Con datos de clientes corre
sólo con sus keys propias. El turno con herramientas no tiene red: para el ws1 queda Groq, Mistral y OpenRouter.

### Lo que quedó SIN hacer

- ⚠️ **La red PROPIA del doer de WhatsApp no corta con datos de clientes** (`lib/mako-doer-in.ts`, el bucle sobre
  `provsGratisDePlataforma`; `mako-doer-in` es `pii` en el catálogo). Es el agujero más grande de esta familia: con
  las keys de un negocio caídas, la conversación con sus leads va a las keys gratis de la agencia. Arreglarlo cambia
  lo que contesta MaKo por WhatsApp a quien no tiene keys propias (con datos de clientes se cortaría), así que se
  escaló al coordinador en vez de tocarlo. **Cerrado el 17/10** (la entrada que sigue a la del modelo de OpenRouter).
- El ws1 sigue teniendo esas dos filas copiadas. Ya no se usan como suyas; borrarlas es una decisión aparte.

· *2026-10-16 chat «Onboarding» (claude3)*

## El modelo gratis de OpenRouter murió otra vez, y estaba copiado en tres lugares (16/10/2026)

**Vive en:** lib/ai-cheap.ts (`MODELO_OPENROUTER_GRATIS`, `MODELO_OPENROUTER_MEDIDO`)

El chat Web Generator midió que `minimax/minimax-m3:free` ya no estaba en `GET /api/v1/models`. Era el tercer id
gratis de OpenRouter que caducaba (antes un Llama 3.3 y un nemotron nano), y estaba escrito a mano en TRES lugares:
el chat de la cascada, `MODELO_DOCS` y `MODELO_VISION`. El respaldo de OpenRouter estaba muerto para texto,
documentos y visión, y un id vencido se ve igual que uno sano hasta que se lo llama.

**Medido ese día, con la lista real y un pedido de verdad** (texto con JSON e imagen, con una key de la plataforma):
`nvidia/nemotron-3.5-super-vl:free` contestó 200, JSON en 1,7-6,1 s e imagen en 0,9-1,6 s. ⚠️ **Razona antes de
contestar: con 200 tokens de tope volvió VACÍO** (un 200 sin contenido), con 300 y 400 bien. El tope más chico que
piden los que lo usan es 300. Los Gemma dieron 429 casi siempre, y dots anda pero tarda 4-10 s y es un preview.

**La regla:** el id es UNA constante y va fijado con su fecha. `tests/openrouter-modelo.test.ts` falla si se
cambia sin anotar la medición o si vuelve una copia. Con `VERIFICAR_OPENROUTER=1` revisa contra la lista pública
que cada id `:free` del repo exista; sin la variable se saltea diciéndolo, porque CI no depende de la red de un
tercero. Crear con IA (`lib/flujo-ia.ts`) y Offer (`lib/offer-ia.ts`) fijaron su propio modelo el 09/10 para sus
pedidos largos (`nemotron-3-super-120b-a12b:free`); sigue existiendo y se quedan.

### Lo que quedó SIN hacer

- Nada avisa solo cuando el próximo caduque: hay que correr el test con red a mano. Un cron que lo mire sería la red
  que falta.

· *2026-10-16 chat «Onboarding» (claude3)*

## La red gratis del doer de WhatsApp y los datos de clientes: se corta lo pedido, no lo que viaja (17/10/2026)

**Vive en:** `lib/doer-herramientas.ts` (`turnoParaLaRed`, `llevaDatosDeClientes`, `SIN_DATOS_DE_CLIENTES`) ·
`lib/api-mako/tipos.ts` (`DATOS_DE_CLIENTES_POR_AREA`, el campo `datosDeClientes` de cada operación) ·
`lib/api-mako/registro.ts` (`leeDatosDeClientes`) · `lib/mako-doer-in.ts` («LA RED DE PLATAFORMA», `armarSystem`) ·
`lib/fallo-ia-texto.ts` (`textoSinRedPorDatos`) · `tests/doer-red-datos-clientes.test.ts`

El bucle propio del doer sobre `provsGratisDePlataforma` no heredaba el corte de la cascada: con las keys de un negocio
caídas (o sin keys, que desde el 15/10 es cualquier cliente nuevo), la conversación sobre sus leads iba al plan gratis
de Gemini y Groq de la agencia, que entrena con lo que recibe.

**El diagnóstico obvio era el equivocado: «si viaja una herramienta que lee leads, se corta».** Las herramientas de
siempre (`buscar_leads`, `ficha_lead`, `historial_whatsapp`…) viajan en CUALQUIER consulta, y «hola MaKo, ¿cómo
estás?» se clasifica `consultar` (medido con `clasificarIntencion` + `herramientasDelTurno`). Sin keys propias, MaKo
habría contestado «esto lleva datos de tus clientes» a un saludo y a «¿qué tengo pendiente en el plan?». Lo que se
mira es lo que la persona PIDIÓ: el registro suma herramientas por las áreas que nombró (`delRegistro`), y si TODAS
leen datos de clientes («¿qué leads entraron hoy?», «agéndame una reunión con Juan») se corta. Si no, la red corre SIN
las que los leen, con el system armado para las que quedan (un prompt que nombra una que no viajó es una trampa). Y
se corta siempre que haya una pendiente vigente con datos de clientes: su resumen va en el system.

**«¿Lee datos de clientes?» lo contesta el registro, no una lista de nombres:** un `Record` por área (un área nueva no
compila sin decidirlo) y la def pisa a su área. En las áreas «sin datos», una operación con nombre sospechoso (lead,
llamada, chat, cobro…) tiene que declarar la marca; si no, el test cae. Lo que el registro no conoce cuenta como que sí.

**El aviso no dice «Conecta tu Claude».** El turno con herramientas corre sólo con las keys baratas del negocio
(`chatCheapTools`); la clave de Anthropic del negocio mueve sólo la cascada de texto. Mandarlo a conectar su Claude
sería mandarlo a algo que no lo arregla: dice «Conecta tu propia API key de IA», con el link a /integraciones.
⚠️ **Con IA16 (en main desde el 24/10) este aviso sale sólo en el ws9**, el único con red: la marca la deja el doer sólo si había red que
saltear, y un negocio sin su IA recibe `sin_keys` («Conecta tu Claude, tu GPT o tu Gemini»; desde WA1 su Claude sí
contesta el turno con herramientas). Ver la entrada de IA16, «el cartel de WhatsApp… un porqué falso» (24/10).

### Lo que quedó SIN hacer

- **El historial del grupo viaja igual**: si en un turno anterior MaKo nombró a un lead, ese texto va en `msgs` a la
  red. El corte es por lo que trae ESTE turno.
- ~~**El Dashboard entero cuenta como datos de clientes**~~ **Arreglado el 17/10/2026 (B5):** 19 lecturas de
  `metricas.def.ts` que traen sólo NÚMEROS llevan `datosDeClientes: false` (revisado runner por runner: ninguna devuelve
  un nombre). Siguen cortando las que nombran personas: `a_quien_cobrar`, `cuotas_pendientes`,
  `listar_leads_embudo_maduro`, y `analisis_negocio` (trae las RESPUESTAS de los que no calificaron, contadas por valor:
  si una respuesta es texto libre, puede llevar un nombre). Test en tests/doer-red-datos-clientes.test.ts.
  ⚠️ **La revisión del Cerebro (17/10, ALTA):** marcar la operación no alcanza, porque la red gratis recibe además el
  HISTORIAL del grupo (avisos con nombres y teléfonos de leads). B5 lo cerró sólo para los turnos con una métrica
  liberada; en paralelo main lo cerró para TODO turno de la red (`soloElTurno`, 50cc3acc8), y al mergear quedó el de main,
  más estricto: un corte por caso deja abierto el caso que nadie pensó. **Sin hacer:**
  si la pregunta misma nombra a un cliente, su nombre viaja (es el texto del turno).
- **Con una pendiente de un lead, también se corta la charla** de ese grupo hasta que la pendiente vence o se resuelve.
- **El guion de audio de Automations** (`app/api/chat-agent/redactar`) tiene su propia red sin el corte: es de
  Automations.
- **Nada se probó contra la red de verdad**: los turnos se arman con lo que corre, pero sin un workspace sin keys
  mandando un WhatsApp real.

· *2026-10-17 chat «Onboarding» (claude4)*

## «Claude vetado» que no era un veto: el `catch` del registro se tragaba el «falló la IA» (ticket #5, 18/10/2026)

- **Síntoma:** a Mauricio (ws1) MaKo no le contestó en el chat de la app. La Ticketera abrió un bug con el mensaje «responder: Claude vetado — «mako-doer» no está en la lista blanca de lib/veto-claude.ts». En `anthropic_usage` quedó `vetado:-`, una fila sin modelo.
- **El diagnóstico obvio era el equivocado:** sumar `mako-doer` a la lista blanca habría pagado Claude por cada turno de MaKo, que es justo lo que prohíbe el veto del 13/8.
- **Causa real:** en `chatClaudeTools` (`lib/anthropic.ts`), un `try { registro + cascada gratis } catch {}` envolvía las dos cosas. Cuando la cascada no contestaba, el llamador pedía `sinFallbackClaude` y el «falló la IA (…)» re-lanzado caía en ese `catch` vacío. El modelo quedaba en `''` y el veto hablaba por él. `chatClaude` ya tenía la lección («Acá afuera del catch, para que el corte no se lo coma»); la mitad con herramientas no.
- **Regla:** un `catch` vacío envuelve sólo la operación que puede fallar «sin importancia» (leer el registro), nunca un camino que re-lanza a propósito. Lo fija `tests/anthropic-tools-sin-fallback.test.ts`: la forma vieja da 3 de 3 fallas.
- **Sin hacer:** con el arreglo desplegado, el ticket #6 (04:13 UTC) trajo el motivo real: «falló la IA (sin proveedor gratis disponible)». El ws1 no tiene NINGUNA IA para el chat de MaKo. La causa probable, no medida clave por clave: desde el 16/10 las copias de las claves de la plataforma no cuentan como del negocio (`lib/ia-keys.ts`), y el ws1 podría no tener ninguna propia que pueda recibir datos de sus clientes. Eso decide Martín: el ticket volvió a él como pedido.

## Un negocio con SÓLO su Claude no tenía IA para el chat, y «Conectar tu IA» le pedía Gemini (20/10/2026)

- **Síntoma** (docs/investigacion-ops-center-19-10.md): un negocio que conectó sólo su Claude recibía en el chat «Para
  contestarte necesito una IA conectada» con el modal de **Gemini**.
- **Causa real:** el turno con herramientas (`chatClaudeTools`, la feature `mako-doer`) corría sólo la cascada barata
  (`CASCADA_TOOLS`: Gemini, Groq, Mistral, OpenRouter, OpenAI). La clave de Anthropic del negocio movía sólo la cascada de
  TEXTO (`conClaveDelNegocio`): en el chat nunca se miraba. Sin ninguna barata, «sin proveedor gratis disponible», y el
  botón tenía Gemini fijo.
- **Arreglo:** la frontera de la puerta 2 es UNA pieza (`permisoDeLaClaveDelNegocio`, lib/anthropic.ts) para los dos
  caminos. En el chat se prueba cuando ninguna barata contestó y la cascada no ejecutó nada (si ejecutó, otro modelo
  duplicaría la escritura): Haiku 4.5, su clave, la marca del negocio primero en el gasto, y nunca el Claude de MaKo. El
  turno la cuenta como IA propia, y el botón abre la IA que el negocio ya tiene en su fila (`iaParaConectar`: su Claude, su
  OpenAI, después las gratis; sin ninguna, Gemini).
- **Medido en vivo** (20/10, con la clave propia del ws10, sin tocar la base): Haiku 4.5 con ese mismo pedido —herramientas,
  sin thinking ni effort— pidió la herramienta, recibió el resultado y contestó. Lo que no se probó: el turno entero en la
  app con un negocio de sólo Claude.
- **Regla:** una IA que el negocio conectó tiene que poder contestar en TODOS los caminos que la ofrecen (texto y
  herramientas), y lo que se le pide conectar es lo que ya eligió, no un default.
- **Sin hacer:** con la pausa de Claude prendida (`mako.claude.pausa`), el negocio con sólo su Claude sigue viendo «Conectar
  tu IA» (le abre su modal de Claude, no Gemini).

## La IA del cliente en SU computadora: lo que no se ve en el código (ola 1, 21/10/2026)

El diseño: docs/ia-del-cliente.md. Lo medido al hacerlo, en esta PC, con Claude Code 2.1.301 y el ws3:
- **`--bare` apaga la suscripción.** Su ayuda lo dice: «Anthropic auth is strictly ANTHROPIC_API_KEY… OAuth and keychain
  are never read». Parece el modo «limpio» para un programa, y es justo el que no sirve. El programa de la PC nunca lo usa.
- **Con `ANTHROPIC_API_KEY` en el entorno, `-p` usa la key y no la suscripción** (code.claude.com/docs/en/authentication):
  el programa saca esa variable (y las de Bedrock y Vertex) antes de correr `claude`.
- **`--tools ""` + `--strict-mcp-config` deja a Claude sin manos:** ni terminal, ni archivos, ni web, sólo las
  herramientas de MaKo del turno. Medido: contestó «Hola» con la suscripción y sin herramientas propias.
- **Sin elegir modelo, Claude Code usa Opus** (medido: `modelUsage` = `claude-opus-5-5`): le gasta el cupo de 5 horas al
  cliente en pocos turnos. Va `--model sonnet`.
- **La carpeta por defecto (`~/.claude`) puede estar sin sesión** aunque Claude Code ande: Martín corre cada cuenta con
  su carpeta (`CLAUDE_CONFIG_DIR`). `claude auth status` dice cuál está logueada (`loggedIn`, `authMethod`, el plan y el
  email) sin mostrar el token. Con varias cuentas, el programa corre cada turno con la carpeta de la cuenta elegida.
- **De punta a punta en el ws3 anda** (`scripts/ia-pc/probar-punta-a-punta.mts`): la PC se empareja, late, toma el turno,
  el Claude real pide las herramientas por el MCP, `turnoApp` las corre con su `runTool` y la respuesta vuelve al chat
  (una lectura en 32 s; «agrega un lead» terminó en la ficha para confirmar, no en un lead creado).
- **Trampa del arnés, no del código:** fuera de Next, las herramientas que usan `unstable_cache` (contar y listar leads)
  tiran «Invariant: incrementalCache missing». En la app corren dentro de Next. Para probarlas de punta a punta hace
  falta el servidor de verdad, no el arnés.
- **`String.replace` con `$'` en el reemplazo pega el resto del texto:** al editar el SQL de la migración con un script,
  el `'^[0-9a-f]{64}$'),` del reemplazo se volvió «el resto del archivo» y duplicó media migración. Para texto con `$`,
  el editor, nunca un `replace` con el reemplazo armado a mano.
- **Sin hacer (ola 2):** «Tus cuentas de IA» y el tutorial; el ejecutable de un archivo (hoy es `node mako-pc.mjs`); el %
  usado de cada cuenta (Claude lo da en el `/usage` del Agent SDK, no en `-p`); que el cliente elija el modelo; varias
  cuentas con rotación. Y el riesgo legal de Anthropic (docs/ia-del-cliente.md §10), que es del Cerebro.

## La IA del cliente, ola 2: el instalador y el % usado (21/10/2026)

- **El % usado está en el stream, no en `/usage`.** `claude -p "/usage"` contesta sólo «You are currently using your
  subscription». `--output-format stream-json --verbose` trae un `rate_limit_event` con `unifiedWindows.five_hour` y
  `seven_day` (`utilization` de 0 a 1 y `resetsAt` en segundos). Medido con Claude Code 2.1.301.
- **Bun compila para Windows y Mac desde esta PC** (`npx bun@1.2.21 build --compile --target=…`): un programa sin
  dependencias sale de 119 MB en Windows y 60-66 en Mac. **Adentro del ejecutable, `process.argv[1]` es una ruta virtual**
  (`B:/~BUN/root/…`) y `realpathSync` tira: «¿me corrieron directo?» se pregunta con `import.meta.main`.
- **Supabase Storage corta en 50 MB por archivo**: comprimidos con gzip entran (43, 23 y 25 MB), y PowerShell y `gunzip`
  los descomprimen en la PC.
- **Bajado por `Invoke-WebRequest` o `curl`, un ejecutable no lleva la marca de «descargado de internet»**: SmartScreen y
  Gatekeeper no lo frenan, y el instalador de una línea no necesita la firma de código. En una Mac con chip de Apple un
  ejecutable sin ninguna firma no corre: el instalador le pone la local (`codesign --sign -`). Sin probar en una Mac.
- **PowerShell 5.1 muestra «qued�»** si el script no pone `[Console]::OutputEncoding = [Text.Encoding]::UTF8`.
- **De punta a punta en esta PC** (`probar-punta-a-punta.mts --instalador`): la línea del tutorial instaló, conectó y
  dejó en Inicio el ejecutable, que contestó un turno con las herramientas de MaKo; la limpieza sacó todo.
- **La guarda de topes lo frenó a tiempo** (tests/rutas-publicas-limite.test.ts): emparejar era una ruta pública sin tope,
  o sea que se podían probar códigos sin límite.
- **Sin hacer (ola 3 y después):** GPT con Codex; el ícono en la bandeja; que la Mac se pruebe de verdad; el riesgo legal
  de Anthropic (docs/ia-del-cliente.md §10), que es del Cerebro.

## La IA del cliente después de la revisión del Cerebro: lo que el camino feliz no mostraba (21/10/2026)

La revisión adversarial de b93a280f1 (5 altos, 9 medios) encontró una pieza que andaba en la prueba de punta a punta y se
rompía en todo lo demás. Lo no obvio, para el que toque esto después:

- **Defender pone en cuarentena un `.vbs` en Inicio que hace `WScript.Shell.Run` oculto** («Trojan:VBS/AgentTesla.GVC!MTB»,
  severidad 5, medido en la PC de Martín a las 02:26 y 04:18). El script del instalador no tiraba error, decía «¡Listo!»,
  el programa corría hasta apagar la PC y nunca volvía a arrancar; la limpieza del e2e lo borraba con
  `-ErrorAction SilentlyContinue` y nunca vio que faltaba. **El arranque es la clave `Run` de HKCU** (`New-ItemProperty`:
  sin administrador, en UTF-16). `Set-Content -Encoding ASCII` además volvía «José Muñoz» en «Jos? Mu?oz».
- **`bun build --compile --windows-hide-console` NO cambia el subsistema del ejecutable** (Bun 1.2.21, medido: queda 3, de
  consola). Arrancado por la clave Run, uno de consola abre una ventana negra. publicar-binarios.mts lo marca «de ventana»
  a mano (el byte de `Subsystem` de la cabecera PE, como `editbin`) y lo verifica. Dos consecuencias medidas: **PowerShell
  no espera a un programa de ventana** ni toma su `$LASTEXITCODE` si no se lo encadena (`& $exe … | Out-Host`), y **cada
  `spawn` de un programa de consola desde uno de ventana abre su propia ventana** salvo con `windowsHide: true`.
- **«No pude leer» tratado como «no hay», dos veces, con dos daños distintos.** `dispositivoDelToken` sin mirar `error`:
  un bache de la base era un 401, el programa de Windows salía «MaKo desconectó esta computadora» y no volvía hasta el
  próximo inicio de sesión, y el chat decía «préndela» con la PC prendida. `pcDe` sin mirar `error`: el turno de la dueña
  de la PC iba a Gemini. Ahora cada lectura tira (`sinError`), las rutas de la PC contestan 503 (lib/ia-pc-ruta.ts) y el
  programa sale SÓLO con un 401 que dice `revocado`. postgrest-js reintenta solo los 503/520 de un GET: no es una red.
- **D6b no se corta en el modelo: se corta abajo de todo, y el diagnóstico obvio no alcanzaba.** La primera versión
  sacaba la cascada en `chatClaudeTools`, y el resto del turno (El Archivero, la foto, la voz, los pedidos) seguía en
  Gemini. Poner el corte en `provDe` (por donde pasan todas las keys) parecía suficiente; el hijo que corre las entradas
  REALES de la cascada contra una base de mentira (tests/_solo-su-ia-hijo.ts) mostró que no: **`ordenarPorCuota` leía las
  keys de cada gratis y le consultaba el saldo a OpenRouter ANTES de que `provDe` cortara.** El corte vive en tres lugares
  (`provDe`, `provsGratisDePlataforma`, `ordenarPorCuota`), prendido por un AsyncLocalStorage (lib/solo-su-ia.ts) que
  `after()` de Next conserva (`AsyncLocalStorage.bind`). Se decide por NEGOCIO (la PC de otra persona cuenta) y falla
  cerrada (lib/ia-del-negocio.ts).
- **Una cuenta al 95 % quedaba descartada para siempre**: el % sólo se medía después de un turno, y sin turnos nada lo
  volvía a medir; `repone` se guardaba y no se leía. Una ventana repuesta cuenta como 0 %, y si todas están al tope se usa
  la de menos uso: el límite lo dice Claude, con la hora.
- **El instalador oficial de Claude no toca el PATH de la ventana abierta** (ni el de una nueva, en Windows): «En la misma
  ventana escribe claude» daba «no se reconoce» en toda instalación nueva. El paso 3 da la ruta completa con
  `claude auth login` (va directo al navegador), y el instalador de MaKo abre el login si falta. Y el programa miraba la
  sesión UNA vez, al arrancar: ahora en cada latido las que no la tienen, y antes de rechazar un turno.
- **`curl | sh` lee el script por la entrada estándar**: lo que pregunta lee de `/dev/tty`, y cada programa va con
  `< /dev/null`, o se come las líneas que siguen. **`irm` y `curl -f` no muestran el cuerpo de un 4xx**: el instalador
  contesta 200 con un `echo` para que la persona lea el porqué.
- **launchd con `KeepAlive` en `true` relanza también una salida a propósito** (cada ~10 s, para siempre, después de
  desconectar). Va `KeepAlive → SuccessfulExit false` y el programa sale con 0 al ser desconectado.
- **Sin red, `fetch` falla al instante y el bucle giraba**: ~1000 pedidos por segundo y un núcleo entero (medido por el
  revisor con un puerto cerrado). Ahora espera 5, 10, 30 y 60 s, y lo anota una vez.
- ⚠️ **CORREGIDO en la segunda revisión (abajo): el «1 en blanco» de tsc NO es el `timeout`, son errores de tipos que no
  se imprimen.** Lo que se creyó entonces, para que se entienda el error:
  **`tsc` envuelto en el `timeout` de Git Bash sale con 1 SIN IMPRIMIR NADA** (medido tres veces, por dos agentes): no es un
  error de tipos. El mismo tsc acotado, sin `timeout` o desde PowerShell, da 0 (y con errores reales imprime y sale con
  2). Un «1 en blanco» de tsc acá es del envoltorio: correrlo sin `timeout` antes de buscar el error. Para iterar, un
  tsconfig que extiende el del repo con `files`.
- **Lo que quedó SIN hacer:**
  - **WhatsApp no tapa las claves** (pieza 1.6): lib/mako-doer-in.ts es de «MaKo en WhatsApp». Dónde: en
    `manejarEntranteDoer` antes de `rutearDoer` (y el `caption`), y en `bufferearYResponder` antes de `encolar`, también en
    el `payload` (docs/ia-del-cliente.md §13).
  - **Las fotos con el Claude de la PC**: hoy, con su propio Claude, se leen con SU OpenAI o se dice que no. Para que las
    vea su Claude: `claude -p --input-format stream-json` acepta bloques de imagen (sin medir).
  - **Claude Code instalado con npm** (`claude.cmd`): `spawn` sin shell no corre un `.cmd`; el tutorial pide el instalador
    oficial. La Mac sigue sin probarse en una Mac.
  - **Los ejecutables 0.3.0 están en el bucket** (los necesitaba el e2e del instalador), pero producción sigue sirviendo
    los 0.2.0 hasta que se despliegue este código: el instalador pide `mako-pc-${VERSION_PC}`.
- **De punta a punta en esta PC, el 21/10 a las 07:00** (`probar-punta-a-punta.mts --instalador`, ws3, la carpeta del
  programa en «…\José Muñoz\AppData\Local»): la línea del tutorial dijo «se va a conectar a «Cliente de Prueba» como
  prueba-ia-pc@…», la clave Run quedó con la ruta exacta (con la ñ) y SEGUÍA 15 s después, nada en Inicio, el Claude real
  de la PC contestó con `listar_tareas_plan` en 32 s, y desconectada desde MaKo el programa se sacó solo del arranque y se
  apagó. Defender: cero detecciones desde las 05:00. La Mac, sin probar.

## La IA del cliente, segunda revisión: lo que pasa FUERA del turno y antes del «sí» (21/10/2026)

La segunda revisión del Cerebro (sobre 71706061d: 2 altos, 6 medios, 17 bajos) cerró los altos de la primera y encontró
que lo que faltaba no estaba en el turno: estaba en lo que corre en OTRO pedido (confirmar una tarjeta, otras pantallas)
y en lo que pasa en la PC antes de que la persona diga que sí. Lo no obvio:

- **D6b prendido en el turno no cubre lo que se ejecuta al CONFIRMAR.** Una tarjeta con costo de IA (analizar una hoja, el
  insight de un lead) no corre en el turno que la propone: corre cuando se toca «Confirmar», en otra ruta o server action
  (`confirmarDesdeTarjeta`, la bandeja /mako/pendientes, /mako/revisar), y ahí no había contexto: los números del negocio
  iban a Gemini y Groq. La regla: **toda entrada que ejecuta trabajo con IA de un negocio prende el contexto ella misma**
  (`conSuIADelNegocio(ws, fn)` o `entrarSoloSuIA`), no lo hereda. tests/_d6b-confirmar-hijo.ts corre los caminos REALES y
  cuenta los hosts; el control (la misma ejecución, fuera) tiene que salir a la red gratis, o la prueba no ve nada.
- **La PC fantasma: activar al emparejar le sacaba la IA a TODO el negocio.** Emparejar dejaba la PC conectada antes de la
  pregunta «¿es tu negocio?»; quien cerraba la ventana ahí dejaba una PC que `negocioConPc` contaba, y el negocio entero
  pasaba a «sólo su IA» sin nadie que contestara. Ahora nace PENDIENTE, el «sí» la confirma, y cuenta recién ACTIVA (un
  latido con una cuenta con sesión): una PC sin Claude Code tampoco cuenta (mig 0322, SIN APLICAR).
- **`Stop-Process` no espera a que el proceso suelte el archivo**: escribir el `.exe` justo después daba «está siendo
  utilizado por otro proceso» (8 de 8, el revisor). Y como el instalador paraba ANTES de preguntar, un «no», un código
  vencido o un 503 dejaban apagada la conexión que andaba. Ahora baja a `mako-pc.nuevo`, para con `Kill()` +
  `WaitForExit(15000)` recién con el «sí», reemplaza con `Move-Item` y reintentos, y un `finally` (un `trap` en la Mac)
  deja uno corriendo pase lo que pase.
- **En Windows, `process.exit()` justo después de dos `fetch` revienta Node** (24.17, medido): «Assertion failed:
  !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 94» y sale con **0xC0000409** (3221226505). `confirmar`
  hace dos pedidos (confirmar y soltar la vieja). Con un pedido solo (`cancelar`) no pasaba, por eso no lo vio nadie
  antes. **Pero el ejecutable que instala el cliente (Bun 1.2.21) NO revienta**: medido 5 de 5 con 0 con `process.exit()`
  y 5 de 5 con el arreglo, el token nuevo guardado cada vez. Lo veían el test y el e2e sin `--instalador`, que corren el
  `.mjs` con Node: ahí el instalador habría leído «no se confirmó» con la conexión YA guardada. Los comandos de una vez
  dejan `process.exitCode` y terminan solos (los sockets de `fetch` no retienen el proceso: < 1 s), con un reloj
  `unref()` de 10 s por si algo lo retiene. El modo de fondo (`correr`) sigue con `process.exit(0)` al ser desconectado.
- **El programa viejo que recibe el 401 borraba la conexión NUEVA.** Reinstalar suelta en MaKo el token de antes; si el
  programa viejo seguía vivo (el Kill falló), su próximo latido recibía `revocado` y su `desconectada()` borraba el token
  del config —que ya era el nuevo— y sacaba la clave Run. Ahora sólo borra si el token del config es el SUYO.
- **El «1 en blanco» de tsc NO es el `timeout` de Git Bash** (el diagnóstico de la primera revisión): sale con 1 sin
  imprimir NADA también sin `timeout`, en primer plano y con la salida a un archivo (medido hoy por dos agentes). Y
  **tampoco es «hay errores»**: una vez coincidió con un error real (`'insertada' is possibly 'null'`, que la API sí
  mostró), pero el otro agente vio el mismo `tsc -p` salir 1 mudo tres veces y después 0 con toda la salida, sin cambiar
  nada. **Es el vigía de RAM, que mata el proceso** (lo dice la cabecera de scripts/tsc-acotado.mjs: «código 1 y cero
  salida»): por eso es intermitente, según la memoria libre de la PC en ese momento. **Lo que sirve es la API**: `createProgram` +
  `getPreEmitDiagnostics` con el tsconfig acotado (un script de 12 líneas, que imprime cada diagnóstico). ⚠️ **Con el
  tsconfig que arma `armarTsconfig` (scripts/tsc-acotado.mjs), no con uno a mano**: ése suma los globales de Next
  (`next/types/global.d.ts`), que hacen OBLIGATORIO `NODE_ENV` en `ProcessEnv`. El mío a mano dio 0 y el VERDE 3
  (`rutaDeClaude({}, …)` en un test: `{}` ya no es un `ProcessEnv`).
- **Adentro de «sólo su IA», las pantallas mentían** (las rutas del Second Brain y del onboarding): `errorDeCascada` decía
  «No hay ninguna IA conectada… con Gemini alcanza», `leerDocumentoIA` «Carga una API key de Gemini (gratis)», El
  Archivero «Prueba de nuevo en un momento», y Buscar «MaKo eligió 0». Y `CONECTA_TU_CLAUDE` tampoco: le dice «Conecta tu
  Claude» a quien ya lo tiene en su PC. Con el contexto prendido, cada una dice `conSuIASinClave(tema)` («para eso
  necesito tu clave de Claude o de OpenAI»), y Buscar vuelve a la búsqueda por texto y lo dice.
- **«Llega a la cascada» es casi todo el repo**: por los `import()`, 370 entradas (rutas y `'use server'`) llegan a
  lib/ai-cheap.ts (`credenciales` → `agenda-evento-etapa-server` → `leads` → `nutricion` → `ai-cheap`, y
  `anthropic` → `ai-cheap`). La guarda que sirve no es «llega» sino «prende el contexto o está decidida»:
  tests/d6b-rutas.test.ts recorre el grafo (resolviendo `@/` y siguiendo las llamadas, no una lista a mano), y lo que
  llaman las pantallas del Ops Center (app/second-brain, app/mako, app/onboarding, app/_chat…) no puede ir afuera.
  - **Una ruta pública del portal del ALUMNO también puede ser «del Ops Center» (27/10/2026):** el botón compartido
    app/_ui/ReportarASoporte.tsx (lo monta el Ops Center) nombra /api/compartido/curso/soporte, y toda ruta del portal
    llega a la cascada DE PASO por `resolverAccesoPortal` (lib/curso-datos.ts → app/customer-success/entrega.ts →
    lib/nutricion.ts → lib/ai-cheap.ts). Como del Ops Center, `FUERA_DE_D6B` no se acepta: si no le pide nada a una IA va
    a `SIN_IA` con lo que usa fijado (así quedó: valida el token y crea el ticket; lib/tickets-db.ts no llega a ninguna IA,
    su triage es con reglas).
- **lib/transcribe.ts es una SEGUNDA cascada sin el corte de D6b**: va directo a Groq y Gemini con las keys del entorno.
  Envolver una ruta que la use no la protege. Hoy la usan ads-manager, cron/transcribe-ads, mako/knowledge y
  lib/onboarding-extract (ninguna del Ops Center).
- **Un stub en `Module._load` no pega en un `await import()` bajo tsx**: el hook corre y gana el módulo real (medido con
  `onboardingPendiente`). Para el onboarding en curso el hijo usa una cookie firmada de verdad (`crearToken`).
- **Fallar cerrado tiene contracara**: si `negocioConSuIA` no puede leer la base, un negocio SIN su Claude queda en «sólo
  su IA» por ese pedido y lee «Con tu propio Claude…».
- **El PostgREST de mentira no pone ids** (tests/_postgrest-de-mentira.ts): sin `defaults`, la PC insertada quedaba sin
  `id`, `estadoDelCodigo` decía «cancelado» y `confirmar` no actualizaba nada. Un hijo que depende del id o de los
  defaults de una columna (`confirmado_at null`, `creado_at`) los declara en `defaults`.
- **Pieza 1.6 (claves pegadas), la tercera ronda: tapaba texto del negocio.** La regla heredada de OpenAI (`sk-` + 20) seguía
  viva mientras `openai` estuviera en `SERVICIO_DE_REGLA`: agregar la nueva no alcanza, hay que sacar la vieja (un slug
  `sk-proj-lanzamiento-verano-2026-…` salía tapado con el botón de OpenAI). La vieja exige 40+ alfanuméricos con dígito y
  mayúscula; las nuevas (`sk-proj-`, `sk-svcacct-`, `sk-admin-`, `sk-None-`) una mayúscula en los primeros 64 (las reales
  traen `T3BlbkFJ`). **«El nombre del `.env` TERMINA en KEY» era una regresión**: `FATHOM_API_KEY_MARTIN` y
  `ELEVENLABS_API_KEY_MAURICIO_IMPAGA` (nombres reales del repo) no terminan así; con `=` vale KEY/TOKEN/SECRET como palabra
  entera seguida de más palabras, con `:` tiene que terminar (`KEYWORDS:`, `MAX_TOKENS`, `TURKEY_RECIPE` ya no se tapan).
  **Un lookahead dentro de una tirada con `-` es cuadrático** (cada `sk-` abre un `\b`; un MB de `sk-proj-` colgaba el
  turno): se acota a 64 y 80 caracteres. El orden entre una regla sin servicio y una con servicio no importa (el bucle de
  `taparClaves` sólo corta con servicio). 26 roturas, todas con su rojo.
- **Lo que quedó SIN hacer:**
  - **La 0322 no está aplicada** (va con la revisión del Cerebro). Sin ella producción no tiene las columnas: este código
    no puede desplegarse antes. La prueba de punta a punta de la PC pendiente (reinstalar sobre una que anda, decir que
    no, cerrar la ventana en la pregunta) espera a la 0322 en el ws3.
  - **Los ejecutables 0.3.1** tienen que estar en el bucket antes de desplegar (el instalador pide `mako-pc-${VERSION_PC}`).
  - **`sk-ant-farm-habitat-kit-for-kids-xl` se sigue tapando** con el botón de Anthropic (la heredada `sk-ant-` + 20): las
    reales son `sk-ant-api03-` + ~93; se podría exigir esa forma (lib/claves-en-el-chat.ts).
  - **WhatsApp sigue sin tapar claves** (1.6 en el otro canal, de «MaKo en WhatsApp», docs/ia-del-cliente.md §13).
  - **La Mac, sin probar en una Mac.**
  - **Las rutas que tests/d6b-rutas.test.ts deja afuera como «decisión pendiente, no olvido»** (`FUERA_DE_D6B`): `v1` y
    `agente` (la API de MaKo), Offer y `onboarding/arranque` (corren con el crédito de Claude; lo decide Offer), y las
    demás tabs (CRM, Ads, Landing, Chat Agent, gráficos, editores, CS, `mako/voz`, `mako/nutricion`…).
  - **Buscar sin ninguna IA (fuera de D6b) devuelve 500 «respuesta sin JSON»** (`parseJsonObject('')` tira) y el
    escritorio muestra «MaKo eligió 0» porque ignora `ok: false` (app/api/second-brain/buscar/route.ts y
    app/second-brain/Grafo.tsx). Viejo, sin tocar.
- **Probado rompiéndolo**: 49 roturas + 23 de las rutas (cada una de las 11 sin el contexto, una ruta nueva sin decidir,
  un área escondida afuera, el detector sin seguir llamadas, cada texto de D6b quitado…), todas con su rojo. Las 49: una por vez y restauradas con sha256, todas con su rojo (los tres caminos de
  confirmar fuera de «sólo su IA» → d6b-confirmar 2/1; la PC pendiente, activa y abandonada, el instalador en Windows y
  en la Mac, el programa, la pantalla y el turno → ia-pc-segunda-revision 16/1 o 14/3; D6b contando una PC no activa →
  solo-su-ia). El arnés: `romper-segunda.mjs` del scratchpad de la sesión.

## La IA del cliente, tercera revisión: «falla cerrada» no es «cualquier cosa cuenta» (21/10/2026)

La tercera revisión del Cerebro (sobre af8f42baf) cerró el alto de confirmar y los medios de las rutas, y confirmó cuatro
medias y tres bajas. Lo no obvio:

- **Contar una COPIA de la clave de MaKo como «su IA» parecía el lado seguro, y dejaba a un cliente sin servicio.** El
  comentario lo decía a propósito («se equivoca hacia el lado de no mandar a Gemini»). Pero el ws1 tiene en su fila
  copias de las keys de MaKo (esperan que Martín decida borrarlas): pasaba a «sólo su IA» sin ninguna IA que sirviera
  (el veto rechaza la copia de Claude, `provsDe` saca la de OpenAI), y Buscar, El Archivero y las áreas, que en main le
  andan, le decían «con tu propio Claude…», falso. La falla cerrada es para lo que NO SE PUEDE LEER, no para lo que se
  sabe que es de MaKo: una copia (también de una cuenta extra, `OPENAI_API_KEY_2`, o con espacios) no cuenta.
- **`descifrar` devuelve `null` sin tirar** (lib/cripto-credenciales.ts): una clave guardada que no se puede descifrar (el
  secreto rotó, la fila se dañó) se leía como «no tiene», y D6b fallaba ABIERTO. Para decidir D6b se mira si la FILA
  existe, no su valor: guardada e ilegible cuenta como suya.
- **Reinstalar abría D6b en el hueco entre soltar la vieja y el primer latido de la nueva** (medido con la función real):
  `confirmar` sólo marca `confirmado_at` y `activa_at` lo pone el latido. Si la sesión había vencido o se cerraba la
  ventana, sin plazo y sin aviso. El arreglo no fue esperar el latido (eso deja la vieja «activa» con el programa ya
  parado), sino **pasar la activación en el servidor al confirmar**, con el token de la de antes como prueba: misma
  persona, mismo negocio y activa. Y el programa guarda la conexión nueva ANTES de soltar la vieja.
- **Un `finally` de PowerShell no corre si se cierra la ventana** (medido por el Cerebro: WM_CLOSE mata PowerShell adentro
  del `try`, 3 de 3, con un programa nativo bloqueando como `claude auth login`). El programa se prendía en el `finally`,
  DESPUÉS del login: cerrar la ventana mientras el navegador pedía la sesión lo dejaba apagado. Lo que tiene que pasar sí o
  sí no puede vivir en un `finally`: se prende antes del paso que espera a la persona.
- **«No latió nunca» no es «abandonada»**: la purga revocaba también una PC CONFIRMADA sin latido, que tiene el arranque
  puesto y late en el próximo inicio de sesión (la de las 03:40 casi siempre gana). Sólo se purgan las que nunca dijeron
  que sí.
- **Desplegar antes de la migración volvía GLOBAL la falla cerrada**: sin la columna `activa_at`, `negocioConPc` tiraba en
  cada turno de cada negocio, y todos los que no tienen clave propia quedaban en «sólo su IA» sin ninguna IA. Un error de
  ESQUEMA (42703, 42P01, PGRST204/205) se distingue y se contesta con lo que se sabe sin la columna: sin ninguna PC
  registrada, «no»; con alguna, falla cerrada. Cualquier otro error sigue tirando. El orden (la 0322 primero) quedó
  escrito en su cabecera, y la cabecera la exige un test.
- **Emparejar gasta el código y anota su PC en dos viajes**: el tutorial que preguntaba en el medio decía «Ese código ya
  se usó y la computadora no quedó conectada» mientras la ventana preguntaba «¿Es tu negocio?». Recién usado sin PC
  anotada es «eligiendo» por un minuto.
- **La guarda de las rutas decidía por ARCHIVO, y un handler nuevo al lado de uno que prende pasaba verde.** Ahora
  tests/d6b-rutas.test.ts decide por handler (cada GET/POST y cada acción exportada), toma como entradas todos los
  `'use server'` del repo (también los de lib/), tiene dos destinos (lib/ai-cheap.ts y lib/transcribe.ts, que el contexto
  no protege) y sigue los imports de las pantallas del Ops Center por todo el repo. Lo no obvio de armarla:
  - **El alcance es por MÓDULO, no por función**: casi todo GET del Ops Center «llega» a la cascada porque lib/archivero
    y lib/onboarding la importan, y por eso hay 32 entradas en `SIN_IA`, cada una con lo que usa fijado. Seguir llamadas
    entre funciones daría falsos verdes: las acciones de MaKo se ejecutan por un registro (`porId(tipo).ejecutar`), que
    una regex no ve.
  - **lib/rutas-publicas.ts se importa del lado del cliente y nombra todas las rutas públicas**: sin excluir sus
    `/api/…`, todo lo público pasaba a ser «del Ops Center». Y el lado servidor de una page no se sigue hacia lib/ (son
    1481 archivos, y las bitácoras de /admin/dev nombran rutas).
  - **/mako/pendientes es otra page**, no cuelga de app/mako/page.tsx: las pantallas son todas las `page.tsx` de esas
    carpetas.
  - **El chat embebe bloques de otras tabs** (la ficha del lead, closing, Web Generator, integraciones, gráficos):
    siguiendo los imports, el Ops Center llega a 57 entradas de otras tabs (149 handlers). Quedan afuera con «decisión
    pendiente»; exigir que prendan es extender D6b a esas tabs (§13 de docs/ia-del-cliente.md, la decide Martín).
- **El AI Analyst programado corre en OTRO pedido** (app/api/cron/dashboard-analisis y landing-analyst-auto): al
  confirmar sólo se guarda el horario. Cada negocio corre ahora adentro de `conSuIADelNegocio`; con su IA y sin una
  clave que lea, la fila queda en error con el porqué (el hijo lo corre: cero hosts gratis).
- **Lo que quedó SIN hacer:**
  - ~~La 0322 sin aplicar~~: aplicada el 21/10, antes del deploy del run 215. Los ejecutables 0.3.2 siguen sin subir (los
    sube Martín). La prueba de punta a punta (`--instalador --reinstalar`) espera a los ejecutables.
  - ⚠️ **Una migración «idempotente» no lo es si su backfill lee un estado que el código nuevo vuelve a producir** (revisión
    de la Ticketera, 21/10 noche). El backfill de la 0322 confirmaba toda PC con `confirmado_at` nulo: antes del deploy eran
    las viejas; después, las que esperan el «sí». Volver a correrla las confirmaba sin el «sí», y la purga (sólo
    `confirmado_at is null`) ya no las revocaba nunca. Ahora el backfill exige `ultimo_latido is not null` (una pendiente
    no puede latir) y la cabecera dice «NO SE VUELVE A CORRER». Regla: el backfill de una migración apunta a lo que existía
    ANTES del código, con una condición que el código nuevo no puede producir. Test: tests/ia-pc-segunda-revision.test.ts.
  - **El AI Analyst programado desde el Ops Center decide con qué IA corre cada vez, no cuando se programó**: la fila no
    guarda desde dónde se programó (tests/d6b-rutas.test.ts lo cubre por el cron).
  - **La Mac, sin probar en una Mac.**
  - **Los demás crons** (avisos programados, los reportes, el Plan) siguen afuera como «fondo», sin revisar uno por uno.
    Las cajas «Conclusiones» programadas van por el mismo envoltorio, verificado leyendo, no corriendo. El render de
    servidor de una page no es entrada de la guarda.
- **Probado rompiéndolo**: 24 roturas de la PC y de las claves, y 34 de la guarda y los crons (cada una de las 11 rutas
  sin el contexto, los tres huecos del revisor, el cron sin contexto o escondido en el prefijo), todas en rojo. Las 24: (tests/ia-pc-tercera-revision.test.ts, base 8/0), todas en rojo. La primera corrida
  dio 23: «la clave de la plataforma ilegible se saltea» pasaba, porque el caso usaba una copia de la PRIMERA cuenta, y
  saltear la ilegible o fallar cerrado daban lo mismo («sí»). Con la copia de la SEGUNDA cuenta (legible) se distinguen:
  saltear la da por copia («no»). Un caso de falla cerrada se prueba donde el error de saltear cambia la respuesta.

## Elegir con qué IA corre UN chat: hoy no se puede, ni por pedido ni por chat (23/10/2026, feedback 8b, investigado)

**El pedido (Martín):** que el «+» de la caja del Ops Center deje elegir el modelo y la cuenta de ese chat (Claude o GPT, y cuál).
Por defecto, que decida el chat jefe.

**Cómo está hoy** (lo leyó una investigación del Ops Center, sin tocar nada):
- **No hay por dónde pasarlo.** Ni POST /api/mako/chat (el body de la línea ~256), ni `EntradaTurnoApp`
  (lib/mako-turno-app.ts) tienen un campo de IA. Todo sale de la configuración del negocio.
- **La computadora:** `pcDe(ws, actor)`, sólo la de quien escribe, y `elegirPc` si tiene varias. El modelo es el de `ia_pc.modelo`
  (MODELOS_PC). Sólo corre Claude: la cuenta `chatgpt` de una PC se informa, pero no contesta.
- **Las claves:** `chatClaudeTools(..., { feature: 'mako-doer', soloSuIA, sinFallbackClaude })`. Con «sólo su IA» va OpenAI
  (`gpt-4o-mini`, sin elección por negocio) y después su Claude, con `permisoDeLaClaveDelNegocio`, que incluye el crédito
  asignado. El modelo de su Claude es `ia.su_claude.modelo` (IA5).
- **`opts.model` NO sirve para esto:** pasa por el control de gasto de la plataforma, no por la clave del negocio.
- **Ya hay piezas:** `soloSuClaude` (directo a su clave de Claude) y `soloSuIA`. Falta un `soloSuOpenAI` que no caiga a Claude.
- **Por chat no se guarda nada:** `chart_sessions.contexto` se crea vacío y nadie lo lee.
- **Las opciones no se pueden leer del navegador:** `/api/ia-pc/estado` le esconde las claves a quien no es admin, y muestra
  las computadoras de todos aunque el turno sólo pueda usar la propia. Las opciones tienen que salir de la MISMA función que valida.

**El contrato propuesto (a IA del cliente, 23/10):**
- `ia?: { cuenta: 'pc' | 'anthropic' | 'openai'; modelo? } | null` en el body, con null = Automático.
- La ruta valida con `cuentasDeIA(persona)` antes de `turnoApp`; en el ws del super admin se ignora y nunca se sale de D6b.
- `turnoApp` lo respeta: la computadora con su modelo sin caer a las claves; su Claude con `soloSuClaude` y el modelo;
  OpenAI con `soloSuOpenAI`.
- `GET ?suIA=1` devuelve también las cuentas que se pueden elegir.

**Acordado y repartido (23/10):**
- **El contrato:** lib/chat-ia-reglas.ts (`EleccionIA`, `sanearIA`, `CuentaDeIA`), en ea27aab61. Puro y sin importar el veto,
  porque el selector corre en el navegador; el test exige que los modelos de su Claude sean los de `MODELO_SU_CLAUDE`.
- **La caja (Ops Center):** está en e316a1918. `SelectoresDelCliente` va adentro del «+». La elección es por chat, y un chat nuevo
  se la lleva a `s<id>` al crearse. Viaja como `ia` en el JSON y en el multipart (archivos y nota de voz), sólo si se eligió algo.
- **El servidor (IA del cliente):** la ruta (validación y `?suIA=1` con `cuentasDeIA`), `turnoApp`, anthropic.ts y ai-cheap.ts.

**Regla, y cómo se cumple:** el selector no sale antes que el servidor que lo respeta. Sólo se dibuja con las `cuentas` que manda
`?suIA=1`, y hoy la ruta no las manda. La caja puede entrar antes y se enciende sola cuando llegue la parte del servidor.

**Trampa:** la nota de voz y los archivos van por OTRO camino (`postArchivos`, multipart) que el texto (`postLargo`, JSON). Un campo
nuevo del turno tiene que ir en los dos, o la nota de voz corre con la IA de siempre.

**SIN HACER:** la parte del servidor; que lo elegido sobreviva a recargar (por ahora vive en la pestaña); y OpenAI con elección de
modelo.

## Lo que gastó la clave del negocio: el «⚠» no dice de quién es la fila (D3 del Ops Center, 22/10/2026)

**El diagnóstico obvio era el equivocado.** Al medir en producción el «Gastó US$ … en los últimos 30 días» de «Tus cuentas de
IA», una consulta con un regex propio (`⚠` o «clave … del negocio») contaba en el ws21 19 filas «de su clave», todas con costo, y
`estadoDeSuClave` sumaba 0. Parecía la regla rota. Era la medición: el «⚠» lo llevan también las filas del **crédito del
onboarding** (`⚠ crédito de Claude de la plataforma (cuenta 1) · Offer: conversar con el dueño`), que paga MaKo.

**Dónde vive:** `esDeSuClave` en `lib/su-clave-reglas.ts`. Para Claude cuenta sólo lo que EMPIEZA con `MARCA_SU_CLAVE.anthropic`
o con `MOTIVO_CREDITO_SU_CLAVE` (el crédito que ES la clave del negocio, como en el ws10). Un prefijo más corto, «⚠ crédito de
Claude de la plataforma», le cobraría al negocio el regalo del onboarding. El test lo cubre con los motivos copiados de producción
(`tests/ops-center-uso-cliente.test.ts`, probado rompiéndolo).

**Medido el 22/10/2026, 30 días:** las únicas filas con la marca «del negocio» son 3 fallos del ws11 («sin crédito»), sin costo.
Ningún negocio gastó todavía con su clave, así que «Sin gasto en los últimos 30 días» es lo cierto hoy, no un default. El que más
filas tiene es el ws9, con 87, y la lectura subió de 500 a 2000.

**Regla:** «de quién es esta fila» se mide con la MISMA función del código (`estadoDeSuClave`), nunca con un regex propio. Los
fixtures de un test que filtra por `motivo` llevan los motivos copiados de producción, no uno inventado: el primer test pasaba
con `«marca» chat`, que no existe.

**SIN HACER:** el gasto es un piso (`anthropic_usage` no anota todo: ver «Tres módulos gastan sin registrar»), y un negocio con
más de 2000 filas en 30 días vería un número corto sin aviso. Hoy el techo es 87 filas.

## Lo que midió la verificación del debate «quién paga el chat» (20/10/2026)

Cuatro verificadores revisaron `docs/debate-ops-center-decisiones-20-10.md` contra producción antes de llevárselo a
Martín. Ese día él decidió que nadie paga el Ops Center de los clientes: cada uno conecta sus cuentas de Claude y GPT.
Las cifras quedan para la próxima vez que alguien calcule un costo o un tope.

- **Un costo «por turno» sacado de `anthropic_usage` sale a la mitad.** La tabla anota una fila por PASO del loop de
  herramientas (`lib/ai-cheap.ts`, `recordUsage` dentro del `for (let step…)`), y un turno son ~2,1 pasos (WhatsApp
  2,26; el Ops Center 2,15; Offer 1,0). El documento llamó «turnos» a llamadas, y el empate «Haiku contra un plan de
  US$47» daba ~3.450 turnos cuando son ~1.700-1.800. **Regla:** un tope por turnos se calcula agrupando las filas por el
  recorte del pedido dentro del `motivo`, no contando filas.
- **«Por mes» no es la suma de 30 días** cuando las features nacieron en el medio. Tres de las cuatro del chat
  (`mako-chat` 09/10, `mako-doer` 11/10, `offer` 12/10) tenían 9 a 11 días: 296 de las 336 filas eran de las últimas
  dos semanas, y el gasto real al ritmo de hoy era ~2× la suma cruda (Haiku: ~US$7 por mes todos los negocios, no 3,69).
  Además, casi todos esos tokens los contó el tokenizador de Gemini, y no está medido cuántos cuenta Claude para el mismo
  texto.
- **Un turno del Ops Center NO carga las ~739 operaciones que ve un admin.** Viajan las 25 de siempre más las de las
  áreas que nombra el pedido, con tope de 12.000 caracteres (`PRESUPUESTO_REGISTRO_CHARS`, `lib/doer-herramientas.ts`):
  entre 0 y ~40 herramientas. Medido con el selector real: una llamada pesa ~9.300 tokens de entrada, y un turno ~21.000.
- **MaKo no sabe si la Gemini del cliente es la gratis, que entrena.** No hay ninguna verificación antes de mandar; la
  única señal es el texto de un 429 («…FreeTier…»), que se anota DESPUÉS (`anotarRebote429`, `lib/ia-cuotas.ts`). Con
  eso está comprobado que el ws13 usa Gemini gratis: el doer de WhatsApp (`mako-doer-in`, pii) le mandó datos de su CRM
  34 veces desde el 17/10. Y el ws14 tiene cargada la MISMA key que el ws13. El corte por pii frena las keys gratis de
  MaKo, no la gratis PROPIA del cliente (`soloLasPropias` sólo descarta las copias de la plataforma). Es el hueco que
  dejó abierto la decisión del 07/10 de no sacarle Gemini a quien sólo tiene Gemini (arriba, «Le sacaba Gemini a quien
  sólo tiene Gemini»). **Sigue abierto y es de Martín:** cortarlo, pedirle una key paga, o que conecte su Claude.
- **El censo de IA de los clientes (20/10):**
  - 11 negocios activos: todos menos el ws9 de la plataforma y los ws3 y ws4 de prueba; el ws5 está pausado.
  - Con Claude conectado hay dos. El ws11 tiene su propia clave. El ws10 tiene, a pedido de Martín, la clave del
    crédito de la cuenta 2, y por eso comparte esos US$200 con el crédito de la plataforma.
  - Sólo con Gemini hay cinco: ws13, ws15, ws17, ws18 y ws19.
  - Sin ninguna key propia hay tres: ws20, ws21 y el ws1, cuyas siete keys de IA son copias de las de MaKo (salvo
    Cerebras, que el chat no usa).
  - Hasta el 20/10 hubo **0 llamadas** pagadas con la clave de Anthropic de un negocio. Ese día lo destrabó
    25f9bbca6 (Ticketera): el turno con herramientas prueba la clave del negocio cuando ninguna barata contestó.

**Dónde están los datos:** los scripts (sólo lectura) quedaron en el scratchpad del Cerebro del 20/10
(`verif-debate/`). Lo que importa está acá.

## La batería guardián del ruteo: 505 pares en `tests/`, con el piso por área (20/10/2026, ola 1, pieza 1.1)

**Vive en:** `tests/ops-center-bateria.test.ts` · `tests/_bateria-ops-center-hijo.ts` · `tests/fixtures/ops-center-frases.json`
(la batería) · `tests/fixtures/ops-center-frases-afuera.json` (lo que no entró, con su motivo).

- **Qué mide:** si la operación de cada frase VIAJA al turno, por el camino real: el clasificador y la selección de
  herramientas, la de la app (`herramientasDelChat`) y la de WhatsApp (`herramientasDelTurno`), con las de siempre reales.
  Hoy los dos canales dan lo mismo, par por par.
- **El piso del 20/10** (lo que llega / lo medido): núcleo 23/40 frases, CRM 40/89 frases, Automations 17/49 frases,
  pagos 35/100 pares, Offer 9/12, Plan, Calendario y Dashboard 20/53, video e imagen 9/14, web y Ads 64/123.
- **Regla: el piso es un trinquete.** Lo que deja de llegar hace caer el test. Lo que empieza a llegar TAMBIÉN, hasta que
  se anota con `ACTUALIZAR_PISO=1` y se commitea con el arreglo. Así la 1.2 sube el piso de cada área en su tanda.
- **En núcleo, CRM y Automations las operaciones de una frase son ALTERNATIVAS** («creame una landing» llega con
  cualquiera de las que crean). Ahí se cuenta por frase. En las demás áreas se esperan todas y se cuenta por par. Contar
  por par en las tres primeras daba 9 rojos falsos: frases donde llega una alternativa y otra no.
- **Las de siempre llevan `server-only`** (`MAKO_TOOLS`, `MAKO_ACCION_TOOLS`): la medición corre en un node aparte con
  `--conditions=react-server`. Medir sólo con sus nombres dio lo mismo, pero el turno real las pasa enteras.

**Trampas al armarla:**
- **Las baterías vivían donde se pierden.** De pagos, 33 de las 90 frases estaban sólo en el transcript de un agente
  (se pasaron por la línea de comandos). Las de landing y Meta en voseo sobrevivían sólo en un `sim.out`: el `casos.json`
  lo pisó la versión en tuteo. El `pedidos.json` de Offer lo pisó el agente de Automations. Los subagentes de una corrida
  comparten el scratchpad: cada uno escribe con nombre propio, y lo medido pasa a `tests/` antes de terminar.
- **Una frase sin su operación no mide nada.** Los scripts de Plan, Calendario y Dashboard, video, Offer y parte de
  Automations no decían qué operación esperaban: 173 frases quedaron afuera.
- **Cinco pares no pueden llegar por la app, y no es el ruteo:** `crear_modulo_curso`, `crear_clase_curso`,
  `publicar_post_comunidad`, `crear_evento_comunidad` y `exigir_2fa_desde` no tienen el canal `app` en el registro.
- **Inflar un `llegaHoy` agregando la clave no hace nada.** JSON se queda con la ÚLTIMA clave repetida, así que el
  original lo pisa. Para romper el piso a mano se cambia el valor que ya está.
- **La fecha del piso es la de Argentina:** `toISOString()` a las 21 de acá ya es el día siguiente.

**Sin hacer:** las 229 frases de `tests/fixtures/ops-center-frases-afuera.json`:
- 173 sin una operación explícita;
- 40 con la batería vacía a propósito;
- 8 con una operación que no existe: `crear_campana`, `agregar_conjunto` y `subir_creativos` de Meta;
- 5 medidas con adjunto;
- 3 «sí» que dependen del mensaje anterior.

## MaKo pregunta con opciones, y la regla de no proponer la impone el código (20/10/2026, ola 1, pieza 1.9)

**Vive en:** `lib/chat-pregunta.ts` (`TOOL_PREGUNTAR`, `crearGuardiaDePregunta`, `retirar`) · el turno de la app,
`lib/mako-turno-app.ts`. Probado en `tests/chat-pregunta.test.ts`.

- **Qué hace:** en el chat de la app viaja `preguntar_al_usuario` cuando el turno lleva herramientas. Lo que pasa el
  modelo se sanea como un G1 (2 a 4 opciones distintas). Una pregunta que no calza vuelve como error y no se muestra.
- **La regla que impone el código, no el prompt:**
  - desde que pregunta, el turno rechaza toda acción, y una lectura sí corre, para armar las opciones;
  - lo que propuso ANTES en el mismo turno se retira también en la base: las tarjetas quedan canceladas y las
    propuestas de pantalla, descartadas, cada una con SU descarte (`aRetirar` + `retirarEnSuPantalla`): la genérica, el
    borrador del plan, la ficha de lead, la propuesta de video y el borrador de WhatsApp;
  - la pregunta se guarda con el mensaje: al recargar vuelve, y si ya hubo respuesta, se ve contestada.
- **La persona contesta tocando** una opción, «Elige tú» o «Saltear», o escribiendo: es su siguiente mensaje. Las
  cuatro pantallas lo mandan igual.
- **Trampa (la revisión del 21/10): «retirar en la base» sólo descartaba la genérica** (/mako/revisar). El borrador del
  plan, la ficha de lead, el video y el WhatsApp quedaban vivos en su pantalla, el mensaje decía «confírmalo abajo» sin
  nada abajo, y al contestar MaKo armaba otro: dos. Se retira sólo lo que creó ESTE turno (`nueva`: una igual que ya
  estaba pendiente no es suya), y con una pregunta no sale el mensaje del borrador ni el de la ficha.
- **Trampa:** la frase del «Hecho» («todos los martes a las 3 a todo el funnel») hoy la clasifica `capturar`, sin
  herramientas. La pregunta no viaja con ella hasta que el clasificador la mande a actuar: eso es la 1.2, con la D1.
  `tests/chat-pregunta.test.ts` lo fija para que se vea el día que cambie.

**Sin hacer:**
- El modelo decide CUÁNDO preguntar (la descripción de la herramienta lo guía). Lo que el código impone es qué pasa
  después.
- En WhatsApp no hay G1: una pregunta allá sigue siendo texto.

## El chat de la app: el negocio con SU nombre, y el guardia de promesas prendido (20/10/2026, ola 1, pieza 1.5)

**Vive en:** `lib/negocio-rotulo.ts` · `lib/mako-context.ts` (`nombreDelNegocioActual`) · `afirmaHechoDe` y
`sanearSalida({ hecho })` en `lib/doer-salida.ts` · `hechoEnElHilo` en `lib/mako-turno-app-reglas.ts` · los contadores
`corridas` y `leidas` del turno, en `lib/mako-turno-app.ts`. Probado en `tests/chat-contexto-guardias.test.ts`.

- **«NEGOCIO DE MARTÍN» en el system de TODOS los negocios:**
  - Estaba en el chat de MaKo y en el asesor de WhatsApp. «del negocio de Martín» estaba además en la retrospectiva
    (dos prompts) y en el asesor.
  - Es el mismo caso del 08/10 (`tests/prompt-sin-dueno.test.ts`), que sólo miraba los encuadres de
    `lib/prompt-defaults.ts`.
  - Ahora el perfil va con el nombre del negocio, y el test barre TODO el código.
  - ⚠️ El asesor de WhatsApp usa `renderPrompt('wa.advisor.system', …)`: un override guardado en Configuraciones puede
    seguir diciendo «de Martín». No se miró la base.
- **El guardia de promesas estaba APAGADO en la app:** `sanearSalida(respuesta, { corrioHerramientas: true })` con el
  `true` fijo. Ahora:
  - se cuenta lo que DE VERDAD corrió: lo rechazado (no permitido, o después de preguntar) no cuenta;
  - lo que MaKo dice CLARO que hizo y el CÓDIGO no respalda QUEDA, con UNA nota al final: «No veo esa acción en este
    chat: revísala antes de darla por hecha.» (`NOTA_SIN_RESPALDO`). Una afirmación clara es la de `afirmacionesDeHecho`:
    primera persona, pretérito CON tilde («mandé»; sin tilde también es subjuntivo: «¿querés que te mande…?»), sin
    negación, sin pregunta y sin hablar de lo propuesto («confírmala abajo»). Respalda (`RespaldoDeHecho.respaldado`) lo
    que escribió en el turno (un control como `cancelar_accion`, si `salioBien`) o una tarjeta confirmada («Hecho: …»)
    después del último PEDIDO de la persona (`confirmadoTrasElUltimoPedido`: un «gracias» no corta), salvo que este
    mensaje sea un pedido. Una nota como máximo por respuesta: la del hecho primero, si no la de una promesa;
  - un dato del contexto («tu landing está publicada») no se toca;
  - el doer de WhatsApp sigue igual: `hecho` es una opción.
- **Lo obvio era el error (la revisión del 21/10): «sin herramientas, lo que dice hecho es mentira».** Después de
  confirmar una tarjeta, «¿quedó agendada?» se contesta desde el «Hecho: …» del hilo, sin correr nada, y el guardia lo
  cambiaba por «pídemelo otra vez y lo hago»: la persona lo pedía de nuevo y se hacía dos veces. Al revés, con UNA
  lectura corrida el guardia se apagaba entero y «ya le mandé el WhatsApp» pasaba. **Regla:** un guardia de «no lo
  hiciste» mira qué lo respalda, no sólo si corrió algo; y lo que dice cuando corta no puede invitar a repetir.
- **Y lo obvio fue el error dos veces más (las revisiones del 21/10).** «Con cualquier "Hecho:" en el hilo, no se juzga»
  lo apagaba entero (en el Ops Center casi siempre hay uno). «Cruzar la frase con el "Hecho:" por las raíces de las
  palabras» (ola1-seguimiento, no entró) borraba de nuevo las verdades: el «Hecho:» real es el resumen de EJECUCIÓN
  («Listo: «Reunión con Ana López» quedó el mar 27 de oct…»), no comparte raíz con «agendé», y la respuesta corta habla
  con un pronombre («Sí, ya te la agendé»). En un banco de 32 frases borraba 8 verdaderas de 14 y atajaba casi nada más.
  Los tests pasaban porque usaban el resumen de la PROPUESTA («Agendar reunión con Ana»), que nunca se anota así.
  **Regla:** borrar una verdad es peor que dejar pasar una mentira, así que el guardia NUNCA borra: agrega una nota. El
  respaldo lo pone el código (lo ejecutado, lo confirmado después del pedido), nunca reglas sobre el texto. Y un test de
  un guardia usa lo que el código anota DE VERDAD (`resultadoAgendar`), no un texto que se le parece.
- **Y la tercera revisión cambió la red, no las reglas.** La versión que nunca borraba igual ponía la nota en 13 de 31
  respuestas que no afirmaban nada (sin tildes, el subjuntivo y el pasado son la misma palabra; las negaciones; las
  ofertas), dejaba pasar 17 de 35 afirmaciones y podía sumar dos notas que se contradecían. Ahora: PRECISIÓN ANTES QUE
  COBERTURA. El banco de la revisión vive en tests/chat-guardia-banco.test.ts y mide, por sha, 0 oraciones borradas, 0
  notas donde no se afirma nada y 0 respuestas con dos notas. Lo que se escapa es un NÚMERO (21/10: 25 de 36 llevan la
  nota sin respaldo; se escapan los estados «ya está hecho», «ya quedó», el plural «lo agendamos» y «te dejé la tarjeta»),
  y el test sólo pide que no baje. La red fuerte es lo que el código dibuja en el hilo, no el texto de MaKo.
- **Y no se lee el texto que no es de MaKo (la cuarta revisión).** Lo que va entre comillas o en una línea «> …» (lo que
  dijo un lead, un borrador para mandar, un copy en primera persona) llevaba la nota: «Juan te respondió: «Ya te mandé el
  comprobante»». Ahora `afirmacionesDeHecho` lo saca antes de leer (`sinLoCitado`), no marca lo condicional («si ya te
  mandé el link…») ni lo que presenta con «:» lo que sigue en el mismo mensaje («Te armé un resumen de la semana:»). La
  nota de promesa va sólo si la promesa es lo ÚLTIMO del mensaje, no es condicional y no hay respaldo; y sacar una
  grosería ya no se lleva lo demás aunque sea corto. **Regla:** antes de juzgar un texto, sacar lo que es de otro.
  Cobertura, anotada como número: el «Hecho» de otra cosa respalda 25 de 30 pedidos NUEVOS que el clasificador no ve
  como pedido; no se arregla con reglas.
- **Y sacar lo citado se llevaba lo que eximía (la quinta revisión, la que cierra el guardia).** Tres cosas, una causa:
  borrar la cita antes de leer. (1) «Voy a armarte un borrador para Juan:\n\n«Hola Juan…»» llevaba «Esto no lo hice»: sin
  la cita, la promesa quedaba última, encima del borrador que estaba a la vista. (2) «Te armé el copy «¿Cansado de perder
  leads?» para el anuncio.» llevaba «No veo esa acción»: el «?» que lo eximía estaba ADENTRO de la cita. (3) Cualquier «:»
  apagaba el juicio: «Le mandé el WhatsApp a Juan a las 10:30.» se escapaba por la hora, que es el formato de las propias
  tarjetas. Ahora la cita se TAPA (mismo largo, `taparLoCitado`): el verbo se busca en lo de MaKo, lo que exime se mira
  con la cita, y lo citado al final cumple la promesa. Un «:» presenta sólo si es puntuación (espacio, salto de línea o
  cita después, y algo más en el mensaje), no en una hora, un link, un emoticón, un paréntesis ni al final. ⚠️ La regla
  más estricta (sólo salto de línea, cita o lista) le ponía nota a «Hice la cuenta: con 14 leads…», que no afirma nada:
  «: » con contenido sigue presentando, y por eso «Ya te armé el informe semanal: lo tenés en el Dashboard.» se escapa.
  **Regla:** lo de otro se tapa, no se saca: sacarlo cambia lo que queda. Medido: 31 de 42 llevan la nota.
- **Y la lista de lo que PUEDE seguir al «:» se olvidó del formato del producto (la sexta revisión, la última).** «Un «:»
  presenta si sigue un espacio, un salto o una cita» dejaba afuera «**Hice la cuenta:** con 14 leads…», «*Te armé este
  resumen:*» y «Te armé un resumen:👇»: CONTEXTO_SECOND_BRAIN le pide negritas a MaKo, así que en el Ops Center es lo más
  común, y volvía «No veo esa acción» donde producción no la ponía. Se invirtió: todo «:» presenta SALVO el que va pegado a
  una letra, un dígito, «/» o un paréntesis (10:30, https:, «:D», «:(»), el que va entre paréntesis que cierran, y el que
  no tiene nada después. «Nada después» incluye lo que el turno dibuja DEBAJO del texto: «Armé la tabla de tus ventas:»
  presenta la tabla, y la nota quedaba entre el «:» y la tabla (`bloquesDebajo`, que pasa `lib/mako-turno-app.ts`).
  **Regla:** cuando una regla de texto decide qué es «normal», se escribe como la lista de lo que NO lo es (corta y
  medible), no como la de lo que sí: la de lo que sí siempre se olvida de un formato. Contado como número, no como
  defecto: contra producción, 19 mentiras pierden la nota (13 porque lo que exime se mira con la cita, como «Le mandé a
  Juan «¿Pudiste ver la propuesta?».»; 4 promesas con «:», como «Dame un segundo: lo busco en el CRM.»; 2 con una cita al
  final), y 20 ganan la nota (las horas, los links y los emoticones).
  Y la séptima revisión (el cierre) acortó esa lista otra vez: el paréntesis («Hice la cuenta (conversión: 21 %).»), el
  emoticón («Te armé el resumen :)» y la lista) y el «:» pegado a una palabra («`etapa:ganado`», «la cuenta:con 14…»)
  también eran formato, y un fuzz de 4.830 textos dio 88 notas falsas en esa familia. Ahora sólo no presenta el «:» pegado
  a un dígito o a «/» (la hora y el link) y el que no tiene nada después. Cuesta 1 del banco (30 de 42: «Moví a Juan a
  Ganado (estado: cerrado).» ya no se marca) y 3 H fuera de él («Ya le mandé el link a Juan :D»), a propósito.
- **Lo obvio era el error: «traer `forzarTool` como WhatsApp».** El chat de la app piensa con razonamiento extendido
  (`thinking: adaptive`), y con él Anthropic no admite `tool_choice: any`. Además `chatClaudeTools` lo pone en TODOS los
  pasos: el turno nunca podría terminar con texto. WhatsApp lo hace con `chatCheapTools` y `toolChoicePrimerPaso`, que
  la cascada de Claude no tiene. Por eso la guardia se apoya en lo que corrió, no en forzar.

**Sin hacer:**
- La persona de MaKo dice «el consultor IA de Martín Koncke» (`lib/mako-persona.ts`). Es la marca: cambiarla es una
  decisión de Martín.
- «Mi hoja» por quien chatea (`ctx.actor`, con 2 o más informes no pedir un email) es del Dashboard.
- `forzarTool` en la app pide un primer paso sin razonamiento, en `lib/anthropic.ts`, que es compartido.
- Lo que el guardia de «hecho» todavía marca de más (bajos de la quinta revisión, `lib/doer-salida.ts`; el guardia queda
  cerrado y esto es su número): las comillas simples ('…', ‘…’), las que no cierran o se mezclan («“…"») y las «» anidadas
  no se tapan; la condición detrás de una viñeta, una negrita o «Y si / Igual, si» (`CONDICION` sólo mira el inicio
  literal); y una grosería ADENTRO de una cita parte la cita («Pedro dijo: «Qué cagada. Ya cancelé la llamada.»» deja
  «Ya cancelé la llamada.»» con nota, sin el «Pedro dijo»). También: «Te armé el asunto «Tu oferta te espera».» lleva
  nota (ya la llevaba en la v2), y la promesa con una firma al final («— MaKo») se escapa.
## El Ops Center no hace lo que la app ya sabe hacer: el freno es el clasificador, no las operaciones (20/10/2026)

**Síntoma:** en el Ops Center del cliente, la mitad de los pedidos naturales no recibe la herramienta que los resuelve. Medido con `herramientasDelChat` y frases reales por área:
- CRM: 41 de 91;
- Pagos: 29 de 90;
- edición de video: 8 de 33;
- Meta, con tuteo: 0 de 18.

**El diagnóstico obvio era el equivocado:** «faltan operaciones en la API». Muchas existen (795 en el registro). El freno es que el turno de la APP usa el clasificador del grupo de WhatsApp: ante la duda anota el pedido como idea («capturar») y le saca a MaKo la herramienta de escribir. Además, el presupuesto de 12.000 caracteres deja afuera la operación que entiende el pedido, y viajan 18 operaciones muertas de Chatwoot.

**Regla:** antes de pedir una operación nueva, medir si la frase natural la hace viajar (`herramientasDelChat` / `herramientasDelTurno`). Las frases medidas pasan a una batería guardián en `tests/`, la pieza 1.1. El mapa completo y el plan por olas: docs/ops-center-principal.md. Las correcciones del crítico, en su Anexo C: el turno también suma las áreas del clasificador, y sin IA propia la app no usa la red gratis.

---

## Las recetas de video e imagen: preguntar lo que cambia el resultado (20/10/2026, Ops Center 1.15)

`lib/doer-recetas.ts` · `tests/doer-recetas-video-imagen.test.ts`

**El caso.** «Cortá el principio del video» no dice qué proyecto ni cuánto, y nada le decía a
MaKo que preguntara: proponía un corte por defecto en silencio. Es la misma familia que «todos los
martes a las 3» (20/10): un dato que cambia el resultado nunca se rellena con un default.

**Lo que se hizo.** Cuatro recetas en `recetasDelTurno` (editor, Generator, AI Avatar, Image
Editor), con la regla de preguntar UNA cosa con 2 o 3 opciones sacadas de los datos reales.

**Reglas que quedan:**
- **La receta del editor viaja con sus 34 ESCRITURAS, no con sus lecturas.** Las lecturas
  (`listar_proyectos_video`, `ver_proyecto_video`) son justo lo que trae una PREGUNTA, y la receta
  pesaría en cada pregunta sin servir para nada. La del Generator sí viaja con lecturas: el saldo
  y el puente son de ahí, y «créditos null es nunca se leyó» importa en la pregunta.
- **Toda operación de video o imagen del registro tiene receta decidida.** El test cruza el
  registro con los grupos de `doer-recetas.ts`: una operación nueva sin grupo pone el test rojo.
- **«Cortá el principio del video» todavía no llega a su herramienta**: el clasificador lo anota
  como idea (es la 1.2, MaKo Alert). El test lo tiene como `todo` con la frase exacta; la receta
  está lista para cuando llegue.

---

## Lo que encontró la revisión de la tanda 1 del clasificador antes de subirla (20/10/2026)

El detalle está en las notas compartidas, `revision-clasificador-tanda-1-20-10.md`.
- **«WhatsApp no cambia» se mide comparando antes y después con las funciones reales y miles de frases, no con un test que fija un caso.** Un `replace` sin `ctx.canal` (`NOMBRADO`, que saca «llamada <nombre>») rompió en WhatsApp «cancelá la llamada pendiente con Juan»: dejó de cancelar, y con una pendiente vigente cancelaba OTRA cosa.
- **Un default «actuar» con `dudosa:false` desarma los candados que miran `dudosa`:** un «ahí hice la prueba» volvió a crear un borrador del Plan (el bug del 25/08).
- **Buscar la operación en TODO el registro trae escrituras de otra cosa cuando la pedida no existe** («borrá la nota» → borrar_audio), y las raíces de 5 letras matchean dentro de palabras («borra» en «borrador»). Una acción que llega sin la lectura que le da el id no «llega».

## Ops Center, pieza 1.2 (tandas 1 a 7): el clasificador del canal app (20/10/2026)

**Pedido (Martín, 20/10):** «comienza a implementar directamente toda mi idea de que Ops Center sea lo principal en MaKo... quiero que en Ops Center se pueda hacer todo, editar videos, crear webs, etc...». Esta es la parte del clasificador (docs/ops-center-principal.md, 2.3 y pieza 1.2); la tanda 1 cubre CRM y Chats, Automations y Clients y el núcleo; la 2, Plan, Calendario y Dashboard; la 3, video, imagen y creaciones; la 4, Pagos y cuenta (cobros, equipo, reportes y avisos); la 5, Offer, Copywriting, Second Brain y experimentos; la 6, el Web Generator; la 7, Meta Ads.

**Medido con el turno real** (`clasificarIntencion` + `herramientasDelChat`, canal app, admin) sobre las frases de los mapas:

| | antes | ahora |
|---|---|---|
| CRM y Chats | 41 de 91 | 91 de 91 |
| Automations y Clients | 17 de 48 | 44 de 44 (las otras 4, abajo) |
| Núcleo | 23 de 40 | 40 de 40 |

Tandas 2 y 3, medidas con la maquinaria de la tanda 1 ya puesta (las frases son nuestras, con la operación esperada sacada del registro; tuteo y voseo): Plan 28 de 30, Calendario 5 de 8, Dashboard 26 de 28, video 35 de 37, imagen y creaciones 8 de 10. Las filas nuevas cierran los últimos: «pasá la tarea…» (el `pasá` es de análisis), «agenda un reel…» (la agenda se lo llevaba), «quitá el gráfico de leads de la hoja» (el detector de leads se lo llevaba), «acelerá el clip» (nada nombraba `velocidad`), «publicá mi landing en la galería de la comunidad» (la landing se lo llevaba) y «dale una estrella» (`dale` es una confirmación). **Una familia puede ganarle a un detector** (`ganaALaAgenda`, `ganaAlLead`, `ganaALaLanding`), y su `relevancia` lleva sólo el nombre de la operación: la de «comunidad» con `post publicar evento crear` sacó `publicar_creacion` del presupuesto.

Tanda 4, Pagos y cuenta (misma medición): cobros 21 de 22 y equipo y cuenta 23 de 28 → 22 y 26 de 26. Cerraron los últimos «dale de baja a Juan» (`dale` es una confirmación), «cambiale el rol a Pedro a closer» (`closer` es un objeto del CRM: el detector de leads se lo llevaba) y «renombrá este chat a Reunión semanal» (la agenda). **Una operación que no es del admin de un cliente no es una falta del clasificador:** `exigir_2fa_desde` tiene gating de PLATAFORMA y no llega a un admin, por eso sus dos frases quedaron afuera de la batería.

Tandas 5 a 7 (misma medición): Offer, Copywriting y Second Brain 24 de 26 y 6 de 8 → 26 y 8; experimentos 10 de 10; Web Generator 35 de 39 → 39; **Meta Ads 30 de 30 sin una fila nueva**, con tuteo y voseo (los mapas medían Meta con tuteo en 0 de 18: lo arregló el verbo al arranque y la búsqueda en todo el registro, no un detector de Meta). Cerraron los últimos «guardá el diagnóstico de fase: etapa…» (`etapa` es un objeto del CRM), «armame el catálogo de productos» y «recomendame formatos de creativo» (`armame` y `recomendame` son imperativos de pensar), «pasá el guion 3 a aprobado», y en la landing «mové la sección de precios arriba» y «ponele el link del VSL»: el detector de landing devolvía sólo `landings creadas` como relevancia y la operación concreta quedaba afuera del presupuesto; ahora suma las palabras de la familia.

**Qué cambió.**
1. **D1 = A.** `clasificarIntencion` recibe `canal: 'app'` (lo pasa lib/mako-turno-app.ts; el doer de WhatsApp no). En la app, sin señal clara se **actúa** —se arma la tarjeta, nada se hace sin el toque— en vez de anotar. WhatsApp sigue anotando, y un test lo fija.
2. **Un verbo de hacer al arranque** (lib/mako-intencion-app.ts, `pideHacerAlApp`): crear, mandar, poner, cambiar, cerrar, programar… en tuteo y voseo, con pronombre pegado («mandale», «ponele»), y el pedido indirecto («quiero crear…», «¿podés cambiar…?»). Sólo al arranque: en el medio de una frase es tercera persona.
3. **Las familias de pedidos** (misma lib, tabla `FAMILIAS`): de qué área es una operación que el pedido no nombra y qué palabras de su NOMBRE la ponen primera en el presupuesto («mail» → broadcast, «automatización» → secuencia, «todos los martes» → automatización recurrente).
4. **Si el texto no nombra un área, la operación se busca en TODO el registro** (lib/doer-herramientas.ts, `buscaEnTodo`): las áreas del texto entran hasta el 60% de los 12.000 caracteres y el resto se llena con lo más relevante de todo el registro.

**Lo que no era obvio.**
- ⚠️ **Cambiar la intención no alcanza.** `herramientasDelTurno` solo suma las áreas del texto cuando el veredicto NO es dudoso (`areasDelTexto … && !v.dudosa`). Un default «actuar» dudoso llegaba sin ninguna operación del registro: el default de la app tiene que ser `dudosa: false`.
- ⚠️ **La relevancia es solapamiento de raíces de 5 letras** (lib/api-mako/registro.ts, `ordenarPorRelevancia`) y un verbo suelto puntúa en cientos de operaciones. «etiqueta crear editar archivar poner sacar lead» sacó `editar_etiqueta` del presupuesto y metió `cobranza_lead` (1.525 caracteres). **La relevancia de una familia lleva el NOMBRE de la operación (verbo y sustantivo), nunca verbos sueltos.**
- Un área ancha se come todo: el CRM tiene 87 operaciones y `cambiar_crons_secuencia` pesa 4.114 caracteres. De ahí el 60%.
- Cuatro detectores de otra cosa se llevaban el pedido: «una etiqueta **llamada** Caliente» era una llamada que agendar (`NOMBRADO`), «**prueba** la automatización» un saludo, «cargá la grabación de Fathom: https://…» un link para guardar, y «creá una plantilla … para recordar la **reunión**» un pedido de agenda (`ganaALaAgenda`).
- **Cuatro operaciones no viajan por la app:** `crear_modulo_curso`, `crear_clase_curso`, `publicar_post_comunidad` y `crear_evento_comunidad` tienen `canales: ['http']`. No es del clasificador; es de Clients abrirlas.

**Las frases del chat de Video / AI Avatar** (frases-video-imagen-1-2.json, 64: 33 de edición de video, 2 del editor, 13 de imagen y 16 del Video Generator): con todo lo anterior ya llegaban 59; las cinco familias nuevas cerraron los últimos (`música` ↔ volumen, `plantilla` + `video` le gana a la plantilla de WhatsApp y a la agenda, `historia de Instagram` / `carrusel` ↔ el Image Editor, «¿por qué no se filma mi anuncio?» ↔ el puente de Flow, `mi voz` / `acento`) más «¿**le** podés poner subtítulos…?», que el pedido indirecto no leía con el pronombre antes del modal. Ahora 33/33, 2/2, 13/13 y 16/16.

**Lo que la revisión adversarial encontró y cómo quedó** (20/10, la sección de arriba; todo arreglado antes de subir, con su test):
- **WhatsApp SÍ cambiaba:** `NOMBRADO` corría en los dos canales y borraba «llamada <palabra>»: «cancela la llamada pendiente con Juan» dejaba de ser agenda, y con una pendiente vigente caía en `confirmar` (con `cancelar_accion`, que corre sin tarjeta). Ahora sólo corre en la app y no borra cuando delante hay un determinante («la», «una», «mi»…). **«WhatsApp no cambia» se mide comparando antes y después con las funciones reales sobre miles de frases** (4.242 frases × 4 contextos = 16.968 turnos, 0 cambian contra `origin/main`), no con un test que fija un caso.
- **Una adivinanza no es un pedido:** el default «actuar» de la app llevaba `dudosa: false` (para que las áreas del texto sumen) y desarmaba el candado «una adivinanza no puede crear nada»: «ahí hice la prueba» volvía a crear un borrador del plan. Ahora lleva su propia marca, `adivina`, que saca `proponer_tareas_plan` y `cancelar_accion`. Y «bueno», «entendido», «buenas tardes» son charla, sin herramientas.
- **Buscar en TODO el registro traía escrituras de otra cosa** («borrá la nota» → `borrar_audio`, «pausá todo» → eliminar una entidad pausada de Meta) y lecturas que gastan IA, por raíces de 5 letras que matcheaban adentro de otra palabra (`cance` en `alcance`) o por una palabra vacía (`esta` es el principio de `estado`). Ahora, en lib/relevancia-app.ts: sólo las áreas que el texto nombra pueden traer una destructiva o una lectura que cuesta; las otras entran por una raíz al PRINCIPIO de una palabra, sin la orden ni las palabras vacías, ordenadas por ese puntaje; y sin raíces útiles no se busca. **Consecuencia:** las destructivas necesitan que el texto nombre su área, así que hubo que sumar las palabras de área a `FAMILIAS` (`crm`, `etiqueta`, `avisos`, `archivero`, `quiz`…).
- **Una acción que llega sin la lectura que le da el id no «llega»:** 28 viajaban sin `ver_proyecto_video`, `listar_landings_creadas`, `leer_hoja_dashboard`… Ahora, tras armar el turno, se suman las lecturas que la descripción de cada acción nombra como origen del id, con un margen aparte de 3.500 caracteres.
- **El 60% del área nombrada le sacaba la lectura a un pedido CON área** (`renombrá la landing` perdía `listar_landings_creadas` contra empates de otras áreas): las otras áreas entran después y con un tope de 25%, y las nombradas vuelven a llenar lo que sobra.
- **Las formas homógrafas de un sustantivo** («marca registrada», «carga lenta la app», «abre a las 9 el local», «deja de inventar») ya no son órdenes: al arranque cuentan sólo con un pronombre pegado o un objeto con artículo.
- **El peso:** el esquema de herramientas por turno de la app pasaba de ~14.600 a ~27.900 caracteres de media sobre las frases medidas (que piden herramientas a propósito), y un mensaje sin señal de 763 a 32.100. Ahora ese mensaje trae ~14.400 (las de siempre, sin registro) y la charla 0. **Sigue siendo el costo de D1 = A:** un turno de la app que actúa carga las 20 herramientas de siempre.
- Queda anotado, sin efecto hoy: si el turno de la app pasara alguna vez por la red gratis de la plataforma (`turnoParaLaRed`), `buscaEnTodo` mezcla áreas y el corte «todas leen clientes» deja de cortar.

**Sin hacer:** completar `esPedidoDeLanding` con lo que sigue sin caer (estilo de sección, versiones, link privado, papelera…) —las frases de acá llegan, pero por la búsqueda y las familias, no por ese detector—; Offer, Copywriting y Second Brain; Web Generator y Ads (los verbos de Meta, después de la 1.4); completar `esPedidoDeLanding`. D1 sigue pendiente de que Martín la confirme (Debate): si cambia a B, la rama es una línea (`deLaApp`). La batería unificada de los 8 mapas es la 1.1 (Ops Center 3); estos tests se unen a ella.

**Para medir sin engañarse:** el presupuesto escribe un `console.warn` de ~10.000 caracteres por turno; un script que lee la salida de un test con `execFileSync` y su buffer por defecto (1 MB) recibe el resumen cortado y se lee «sin fallos». Pedir `maxBuffer` grande.

**Vive en:** `lib/mako-intencion-app.ts` · `lib/mako-intencion.ts` (`canal`, `buscaEnTodo`, `NOMBRADO`, las reglas 6-quater y el default) · `lib/doer-herramientas.ts` (`buscaEnTodo`) · `lib/mako-turno-app.ts` (`canal: 'app'`) · `lib/relevancia-app.ts` · `tests/ops-center-clasificador-app.test.ts` (48 tests; 107 roturas, cada una con su fallo) · *20/10/2026, sin subagentes.* La segunda revisión (21/10) está en la sección de abajo.

## Ops Center 1.2 en main: «devolvele el pago a Carlos» dejó de llegar a reembolsar_cobro (22/10/2026)

Con OC1 en main (tren 1), tests/ops-center-bateria.test.ts dio `pagos-cuenta` 34/100 con piso 35 en el chat de la APP (WhatsApp
seguía en 35). El área y la pista estaban bien: el clasificador ve el objeto «reembolso». La frenaba la puerta de las
destructivas (lib/relevancia-app.ts → `puertaDeDestructivas`): `reembolsar_cobro` es destructiva por su verbo, y la abre sólo un
pedido de QUITAR (lib/mako-intencion-app.ts → `pideQuitar`). «Devolver» no es un verbo de quitar.

- **Arreglo:** devolver PLATA abre la puerta, con su objeto (`OBJETO_REEMBOLSO`: el pago, la plata, el cobro, «el reembolso»).
  «Devolvele la llamada» no la abre: «llamada» es sinónimo de reunión y abriría `cancelar_reunion`. La regla del objeto es
  UNA, en mako-intencion-app.ts, y el clasificador la importa de ahí (al revés armaría un ciclo de imports).
- **Por qué no lo vio nadie:** la batería pasa en un proceso compartido (`--test-isolation=none`) por el estado que dejan otros
  tests, y falla SOLA. Los VERDE de OC1 y la tanda del tren dieron verde. **Regla:** al tocar el clasificador o la selección de
  la app, la batería se corre sola (`node --import tsx --test tests/ops-center-bateria.test.ts`).
- El piso subió (`ACTUALIZAR_PISO=1`): con OC1 llegan 5 frases más del chat de la app, y quedaron anotadas.

## Ops Center, pieza 1.2, segunda revisión: la red es la tarjeta, no la regla (21/10/2026)

**Qué pasó.** Con la ronda de reglas del 20/10 ya en la rama, una segunda revisión adversarial (tres lentes; 11 errores confirmados y 3 bajos sin refutar) midió con el turno real de la app lo que esa ronda había dejado. No eran once olvidos: era el mismo error once veces. **Cada regla evitaba una cosa y dejaba afuera, o metía, otra.**

| síntoma medido | causa |
|---|---|
| «cancelá llamada pendiente con Juan» (sin artículo, «nuestra», «la 2da») dejaba de ser agenda y, con una tarjeta abierta, caía en `confirmar` con `cancelar_accion` | `NOMBRADO` con una lista **cerrada** de determinantes delante de «llamada» |
| «ahí hice la prueba con el reel de hoy», «sos una estrella», «el link de la agenda no anda» volvían a traer `proponer_tareas_plan` (el bug del 25/08) | una familia con `actua` se saltaba la marca `adivina` |
| «escribile a Juan que mañana lo llamo» traía `borrar_chat_whatsapp_empresa` y `descartar_borrador_whatsapp_empresa`; «programá el broadcast…», `eliminar_broadcast` | «borra» está **dentro** de «borrador» y la relevancia de la familia lo llevaba |
| «sacá la dependencia entre la landing y el dominio» perdía `quitar_dependencia_plan` y traía la inversa; «pausá el sitio» perdía `pausar_landing` | la pasada 2 descartaba toda destructiva de un área que el texto no nombra |
| «poné el enlace de la agenda en la landing» traía la acción sin `listar_landings_creadas` | la pasada de las lecturas del id sólo corría con `buscaEnTodo` |
| «eliminá las muletillas del video» traía `reiniciar_personalidad` (borra el quiz de voz entero); «eliminá el guion viejo», `proponer_eliminar_entidad_meta` | las filas `area-*` de las familias abrían **todas** las destructivas del área por una palabra suelta |
| «invitá a Ana», «completá la guía de voz», «destilá la voz…» no llegaban | `reversible: false` contaba como destructiva: lo llevan 127 de 353 acciones (enviar, invitar, crear) |
| «borrá el audio 3», «anulá el link de Juan», «cancelá el análisis», «sacá a Juan de la secuencia» no llegaban | su sustantivo no estaba en ninguna tabla de áreas |
| «borrá el historial del chat de Juan» no traía `borrar_chat_whatsapp_empresa` | `chats` no es `whatsapp`: la puerta era por área |
| «cargá 3 tareas para mañana», «guardá como tarea…», «programá para el lunes la tarea…» perdían `proponer_tareas_plan` | las homógrafas pedían un artículo; un número, «en», «como» o «para» no contaban |
| «vale» / «me parece bien» a «¿querés que pase a Rosana a Agendado?» dejaba a MaKo sin herramientas | el acuse era charla sin mirar si MaKo había preguntado |

**Lo que el diagnóstico obvio tenía mal.** (1) *Sumar la palabra que falta a la tabla de áreas* causó la mitad: cada fila de área abre una puerta a TODO lo destructivo del área. (2) *Contar `reversible: false` como «destructiva»* parecía prudente y frenó altas, envíos e invitaciones; lo irreversible no se frena por una marca del registro, lo frena la tarjeta, que lo dice antes del toque. (3) *El «0 diferencias en WhatsApp» del arnés del 20/10 era cierto y no probaba nada* (la sección de abajo).

**La decisión (el Cerebro, con la nota de la revisión): no otra ronda de reglas, cambiar la red.**
1. **La red es la tarjeta.** En la app toda escritura deja una tarjeta que una persona toca (`alcance: 'proponer'`; `ejecutarOperacion` nunca llama a `run.ejecutar`, sólo `confirmarPendiente` lo hace). La única operación del registro que cambiaba algo sin tarjeta, `cancelar_accion`, **ya no viaja por el chat de la app** (cancelar es el botón «Cancelar» de la tarjeta; el system se lo dice a MaKo). El test recorre el **registro entero**: en el chat sólo viajan lecturas y acciones con tarjeta (741 operaciones en la vista de un admin: 389 lecturas y 352 acciones), y las 162 que quitan algo o son irreversibles son acciones, no controles.
2. **Lo que quita algo entra por la COSA que el pedido nombra, nunca por el área** (lib/relevancia-app.ts, `puertaDeDestructivas`). Una operación cuyo id lleva un verbo de quitar (borrar, eliminar, cancelar, anular, quitar, sacar, pausar, archivar…) entra sólo si el pedido pide quitar (`pideQuitar`, en cualquier parte del texto y con la forma de la orden: «borrador» o «se me borró» no cuentan) **y** nombra su cosa (`nombraLaCosa`): el sustantivo de su id (con una o dos palabras en el id alcanza una; con tres, dos de ellas), el único sustantivo de su título, un sinónimo (`SINONIMOS`: «gráfico» → componente, «sitio» → landing, «pago» → cobro…) o una palabra que sólo es de ella. Si no la nombra, **no llega ninguna parecida y MaKo recibe la instrucción de preguntar cuál** (`INSTRUCCION_QUITAR_SIN_OBJETO`). Una destructiva que pasó la puerta entra primero a la pasada 2 aunque su nombre no comparta raíz con el texto.
3. **Las lecturas que dan el id llegan en TODO turno de la app** (`herramientasDelChat`, no sólo `buscaEnTodo`), y el test exige que la acción pedida llegue **con** su lectura, en todas las frases de las baterías.
4. Los arreglos chicos, cada uno con su frase y su rotura: `NOMBRADO` sólo detrás de un **sustantivo** que se nombra; una familia sola, sin verbo de hacer, es una `adivina`; el sí de un acuse después de una pregunta de MaKo; las homógrafas con número, «en», «como» y «para»; las familias «completá la tarea…» y «abrí de nuevo la tarea…»; el 75% / 25% de las pasadas; `area-ads` ya no toma «publicó»; un verbo que está en el id de pocas operaciones (invitar, inscribir, destilar) puntúa aunque se le saque al texto.

**Lo medido** (el arnés de abajo; 48.583 frases —todos los literales de texto de `tests/*.test.ts`, que incluyen las baterías y las de la nota—, `origin/main` contra la rama):
- **WhatsApp: 582.996 turnos (48.583 frases × 12 contextos), 0 cambian.** Se compara el turno entero (veredicto, aviso, herramientas en orden con el hash de su definición, `delRegistro`, áreas, `ofrece`, instrucción). Y el comparador sí ve cambios: contra un commit de hace 120 commits, 4.000 frases, cambian 17.385 de 48.000 turnos (36%).
- **La app: 145.749 turnos (48.583 frases × 3 contextos: sin nada, con una tarjeta abierta, con una pregunta de MaKo); 140.920 cambian (96,7%), y cada cambio tiene su causa:**
  - *Intención:* 134.897 `capturar(dudosa) → actuar` es D1 = A (la app propone con tarjeta en vez de anotar); 52 `capturar(dudosa) → charlar` son los acuses («bueno», «buenas tardes»); 75 `pensar → actuar` y 54 `consultar → actuar`, los pedidos con un verbo de hacer («¿podés cambiar la hora?»). El resto no cambia de intención: cambian las herramientas.
  - *Ganan:* las 20 de siempre en cada `actuar` nuevo: es el costo de D1 = A, anotado más arriba.
  - *Pierden, 4.816 turnos con alguna pérdida:* **controles 4.086** (`cancelar_accion`: se fue a propósito); **acciones que quitan algo 1.579** (`cancelar_reunion_calendly`, `proponer_cancelar_reunion`, `quitar_lead_de_producto`, `baja_del_cliente`, `despublicar_landing`, `borrar_landing_creada`, `archivar_etiqueta`… en pedidos que no piden quitar nada: «agendame una reunión», «movela al viernes», «subí la landing con animaciones», «reembolsale el pago»); **lecturas 5.726** (el CRM entero ya no se lleva el 100% del presupuesto en un pedido de agenda: `notas_lead`, `journey_lead`, `historial_lead`… en «agendá una visita con Juan»; entran las de otras áreas que puntúan, hasta el 25%); **otras acciones 419** (las de una vecina que sólo estaba por el área: `proponer_mover_reunion` en «creá una etiqueta llamada Caliente», que ahora no es una llamada; `renombrar_landing` en «quitá las animaciones»).
  - *Ninguna pérdida es una destructiva que se pidió y se nombró:* el script de análisis cruza cada pérdida con `pideQuitar` + `nombraLaCosa` y quedan 5, todas de la operación equivocada («apagá la campaña» perdió `proponer_eliminar_entidad_meta`; «quitá el gráfico de leads…», `quitar_lead_de_producto`; «borrá el clip 3», `revertir_clip_video`): las que sí piden están.

**El arnés, hecho script** (la regla ya está en la sección de abajo): `node --import tsx scripts/medir-turnos-por-sha.mts <antes> <después> [--canal=app|whatsapp|ambos] [--reusar] [--exigir-igual]`. Extrae `lib` y `app` de cada commit con `git archive` a `<tmp>/turnos-por-sha/<sha>` (con `node_modules` enlazado) y corre `scripts/volcar-turnos.mts` **una vez por árbol y en su propio proceso**; vuelca el turno real de cada frase (3 contextos de la app, 12 de WhatsApp) y compara el turno entero, con un resumen de transiciones de intención y de herramientas que ganan y pierden, cada una con una frase de ejemplo. `--exigir-igual` sale con 1 si algo cambió: es la prueba de «WhatsApp no cambia» y conviene correrla ANTES de pasar una punta que toque el clasificador. Cuatro trampas que costaron un rato: (1) `lib` importa de `app` en tiempo de ejecución (`lib/graficos-temas.ts` → `app/_cursos/fuentes`), así que el árbol lleva las dos carpetas; (2) el `tar` de Git para Windows lee `C:\` como un host remoto: se extrae con rutas relativas; (3) el volcado de WhatsApp pasa de los 500 MB, más que un string de Node: se compara en flujo, con un hash por turno; (4) **`readline` corta las líneas también en `\r`, U+2028 y U+2029**, que `JSON.stringify` deja sin escapar dentro de una frase: se separa sólo por `\n`.

**Sin hacer / límites que quedaron medidos.**
- «suspendé a Pedro» y «sacá a Juan de Bienvenida» **ya no traen la operación: MaKo pregunta** («¿a quién del equipo?»). Es la decisión (la cosa no está nombrada); la frase con la cosa («suspendé al miembro Pedro», «sacá a Juan de la secuencia Bienvenida») llega.
- «meté a Juan en Prospección» no llega a `inscribir_lead_secuencia` (no es una destructiva, y ninguna palabra suya nombra la operación): sigue como estaba en main.
- `SINONIMOS` es una tabla chica y a mano (landing, componente, hoja, miembro, entidad…): una palabra nueva con la que la gente nombre una cosa hace preguntar, no equivocarse. Se suma con su frase en el test.
- El costo de D1 = A (un turno de la app que actúa carga las 20 de siempre) sigue en pie, y D1 sigue pendiente de Martín. El instruct «preguntá cuál» también aparece en «sacame un reporte»: dice, en la misma frase, que no aplica a eso; si se vuelve ruido, el arreglo es excluir esos objetos de `pideQuitar`.

## Un arnés «antes / después» mide un COMMIT sólo si extrae los árboles por SHA y corre un proceso por árbol (21/10/2026)

La segunda revisión del clasificador de la app (f226f8c22) confirmó que WhatsApp no cambia: 245.146 líneas comparadas, 0
diferencias. Comparó el veredicto entero, las herramientas EN ORDEN con un hash de descripción y schema, `delRegistro`,
la instrucción y `turnoParaLaRed`, con 161 frases difíciles en 12 contextos más 59.296 literales de los tests. Con
`canal: 'app'` cambian 3.244 de 7.962 líneas, así que la comparación detecta cambios cuando los hay. **El arnés del
autor, que daba «0 de 16.968», no lo probaba**, aunque esta vez no escondía nada:
- importaba de worktrees VIVOS: uno se movió de 7f904a03c a b0ce18002 durante la revisión, y el otro tenía cambios sin
  commitear. Su número no estaba atado a ningún SHA;
- cargaba los dos árboles en UN proceso. tsx resuelve `@/` con el tsconfig del cwd, así que `@/lib/capas` era el mismo
  módulo para los dos lados;
- su clave ordenaba los nombres de las herramientas y dejaba afuera porque, alternativa, aviso, descripciones, schemas e
  instrucción, y fijaba un solo contexto.

**La regla:** antes/después = `git archive <sha>` de cada lado a una carpeta propia, un proceso por árbol con su cwd, y
comparar TODO lo que decide la salida, byte a byte. Y probar que la comparación detecta un cambio conocido: si con
`canal: 'app'` también da 0, el arnés está ciego. Los scripts del revisor están en el scratchpad del Cerebro
(rev-wa-f226/s/volcar.mts). *Cerebro, claude4.*

## «Tiene su IA» no es «su IA contestó»: el fallo de la clave del negocio no dejaba rastro (IA3, 22/10/2026)

**Vive en:** `lib/su-clave-reglas.ts` (el motivo corto y la línea de la tarjeta) · `lib/su-clave.ts` (anotar, leer, probar)
· `lib/anthropic.ts` (`conClaveDelNegocio` y `chatClaudeTools` con su clave) · `lib/ai-cheap.ts` (`anotarSuOpenAI` en la
cascada de texto, la de herramientas, la visión y el audio) · `app/integraciones/TusCuentasIA.tsx` · `tests/su-clave.test.ts`

- **Síntoma:** en toda la historia de `anthropic_usage` hay 0 filas con la marca «⚠ clave de Anthropic del negocio», aunque
  el ws10 y el ws11 la tienen cargada y `negocioConSuIA` dice que sí. Entre el 17 y el 20/10 el ws11 corrió landing-analyst,
  carousels-writer y chatbot-crear-ia por Gemini sin una sola fila de su Claude. Desde el panel, una clave rota (inválida,
  sin crédito) y una que nunca se probó se veían igual.
- **Causa:** `conClaveDelNegocio` devolvía `{ error }` a `erroresOut` sin anotarlo, y la cascada seguía con lo de abajo.
  Lo de OpenAI, igual: su fallo sólo dejaba un `console.warn` (y una fila `rebote429:` si era cuota, sin decir de quién).
- **Regla que queda:** cada fallo de la clave del negocio deja una fila (0 tokens, US$0, el molde de `vetado:` y
  `rebote429:`): `model = fallo:<modelo>` y el motivo con la marca del negocio PRIMERO (`insertUsage` corta a 200) y el
  porqué CORTO (`motivoCorto`: sin crédito, clave inválida, sin permiso, tope por minuto, no contestó). La tarjeta lee la más
  reciente entre «anduvo» y «falló». Una fila por negocio, proveedor y motivo cada 5 minutos (la cascada le vuelve a pegar a
  la misma clave hasta 4 veces). En el workspace de la plataforma no se anota: su clave es la de MaKo.
- **Trampa medida:** el 401 de OpenAI trae la clave ENMASCARADA en el texto («Incorrect API key provided:
  sk-proj-****abcd», curl del 22/10). Ese texto ya viaja a `erroresOut` y a los logs; a una fila que lee un panel no va
  nunca: el motivo es una categoría, no el mensaje. Y el «sin crédito» de OpenAI es un **429** (`insufficient_quota`):
  mirado después del tope por minuto, una cuenta sin plata se leía como «esperá un minuto».
- **«Probar mi clave» no prueba el crédito.** Usa pedidos que no cobran (`/v1/messages/count_tokens` de Anthropic, la lista
  de modelos de OpenAI): dicen si la clave es válida, no si tiene saldo. El saldo lo dice la próxima respuesta, que deja su
  fila. Por eso la pantalla dice «es válida», nunca «anda».
- **Sin hacer:** la prueba en el ws3 con una clave inválida pegada por Martín (necesita el deploy, y poner una clave en el
  ws3 lo pasa a «sólo su IA» mientras dure: los arneses de otros chats que prueban en el ws3 cambiarían de camino). El ws11
  real: la próxima vez que use IA, su fila dice por qué falla, sin que nosotros usemos su clave.

## Desplegado no es funcionando: el instalador de la PC contestaba el error con un 200 (IA1/IA2, 22/10/2026)

**Vive en:** `app/api/ia-pc/instalar/route.ts` · `scripts/ia-pc/publicar-binarios.mts` · `scripts/ia-pc/verificar-binarios.mts`
· `lib/ia-pc-reglas.ts` (`faltanEnElBucket`, `informeDeBinarios`) · `tests/ia-pc-binarios.test.ts`

- **Síntoma:** la 0.3.2 está en producción desde el 21/10 y el bucket privado `ia-pc` sólo tiene 0.2.0 y 0.3.0 (medido
  el 22/10 con `verificar-binarios`). Firmar `mako-pc-0.3.2-*` da «Object not found» y la línea del tutorial contesta
  «No pude preparar la descarga» a TODO cliente nuevo. Nadie lo vio: la ruta contesta 200 con un `echo` (a propósito: con
  un 4xx, `irm` y `curl -f` no muestran el cuerpo), y un 200 no es una falla en ningún log.
- **Por qué pasó:** la prueba de punta a punta del 21/10 pasó porque la 0.3.0 se subió desde la PC de Martín; la 0.3.2 se
  desplegó sin que nadie subiera la suya, y el comando del resumen apuntaba a un worktree ya borrado (C:/dev/wt-ia-ola2).
- **Regla que queda** (AGENTS.md, «un código que pide un archivo del Storage no se sube sin el archivo»): antes de subir
  un cambio de `VERSION_PC`, `verificar-binarios` (lista Y firma, como el instalador; sale con 1 si falta). Y la ruta que
  no puede firmar deja su fila en `errores_app` (huella «ia-pc: falta el ejecutable …»), que ven el vigía y la Ticketera.
- **Trampa del script:** `publicar-binarios` terminaba con `process.exit()` después de los pedidos, y en Windows Node
  revienta así («Assertion failed … async.c line 94», medido en el seco del 22/10): el código de salida mentía. Ahora deja
  `process.exitCode`. Y un worktree no trae `.env.local`: sin `--env` el script lo dice (antes seguía sin base).
- **Sin hacer:** subir la 0.3.2 (`publicar-binarios --aplicar`, escribe en producción: espera el OK de Martín) y la
  prueba de punta a punta en la PC de Martín con el ws3 (`probar-punta-a-punta.mts --instalador --reinstalar`). El título
  del ticket de la fila sale genérico («Falló la pantalla «Api»», de `tituloDeError` en lib/errores-app-reglas.ts); el
  mensaje sí dice qué falta.
- **«Descargando MaKo en tu computadora…» para siempre (22/10, la PowerShell de Martín):** era la barra de progreso de
  `Invoke-WebRequest` en Windows PowerShell 5.1, que se redibuja por cada pedazo que llega. Medido con el mismo archivo de
  42,7 MB: **58,6 s con la barra contra 4,1 s sin ella**, y eso sin ventana (con ventana, peor). Ahora el script pone
  `$ProgressPreference = 'SilentlyContinue'` antes de bajar. **Regla:** todo `Invoke-WebRequest` de un script que corre
  en la PC de un cliente va con la barra apagada.

## «Tus cuentas de IA» por cuenta y dispositivo, y dónde está cada uno (23/10/2026)

**El pedido** (Martín, por el Cerebro, con capturas del ws1): sin el botón «Conectar tu IA»; arriba «Nueva cuenta» (Claude o
ChatGPT); cada cuenta, UN bloque «Cuenta 1», «Cuenta 2» (no «MSI») con su email, su plan y su uso; adentro sus dispositivos con
«Desconectar», y «Nuevo dispositivo» con la descarga a la vista; cada dispositivo con su UBICACIÓN como Google («Grandbourg,
Buenos Aires, Argentina»); fuera el «Modelo» (se elige en cada chat), «Tu clave de Claude» y el crédito (sólo SuperAdmin); el
mismo dibujo en SuperAdmin; en la computadora y en el teléfono.

**Vive en:** `agruparPorCuenta`, `textoDeUbicacion`, `dondeEsta` (lib/ia-pc-reglas.ts) · app/integraciones/CuentasYDispositivos.tsx
(el dibujo compartido) · TusCuentasIA.tsx · app/m/cuenta/ia/IaM.tsx · app/admin/ComputadorasDelNegocio.tsx (desde el 23/10) · el latido
(app/api/ia-pc/latido/route.ts) · supabase/migrations/0327_ia_pc_ubicacion.sql · tests/ia-pc-cuentas-dispositivos.test.ts.

- **Agrupar por cuenta se hace en el SERVIDOR, no en la pantalla.** Quien mira recibe el email ajeno enmascarado, y dos
  «m***@gmail.com» pueden ser dos cuentas distintas. Se agrupa con el email entero y recién después se enmascara, con la
  misma regla de siempre.
- **La ubicación sale de los headers de Vercel, sin ningún servicio de terceros:** `ubicacionDeHeaders` (la de las visitas
  del VSL) nunca lee la IP. Se guarda sólo el TEXTO «ciudad, provincia, país», sin coordenadas. El nombre de la provincia
  está para Argentina y México; en otro país se saltea, sin inventarlo. El país sale de `Intl.DisplayNames`. Un latido sin
  los headers (local, o fuera de Vercel) no borra la última ubicación.
- **El código aguanta la mig 0327 ausente:** el latido reintenta sin la columna (D6b depende de que se anote) y las listas
  la dejan en null. La migración se aplica después de la revisión del Cerebro.
- **Trampa del PostgREST de mentira:** devuelve la fila entera, sin mirar el `select`. Un test de «falta la columna» tiene que
  sacar el campo de las filas; si no, pasa por la razón equivocada. Lo agarró la primera corrida.
- **Un componente que un test dibuja en Node no importa su CSS:** Node no carga un `.css`, y el test de SuperAdmin dejó de
  cargar. CuentasYDispositivos.tsx no lo importa: lo importan TusCuentasIA.tsx y las páginas del super admin.
- **Lo que se fue a pedido de Martín:** el «Modelo» del panel, «Tu clave de Claude» y su gasto (lo había sumado Ops Center en
  D3), y «Usa el crédito de Claude que te dio MaKo». El crédito queda en SuperAdmin › Uso.
- **La revisión de privacidad (23/10) agarró lo que queda DESPUÉS:** «Desconectar» revoca la fila pero no la borra, y su
  última ubicación y los emails de sus cuentas quedaban para siempre. Ahora desconectar los borra. También quedó cerrado:
  - el latido se anota aunque la base rechace el texto de la ubicación (no sólo sin la columna);
  - se sacan los caracteres invisibles y los que invierten el texto, y los medios emojis que deja un corte;
  - la cuenta se agrupa por PERSONA y email: el email lo declara la PC, y un miembro podía meter la suya en el bloque del admin.
- **SIN hacer:** una cuenta de ChatGPT conectada SÓLO con una clave de API no aparece como «Cuenta», porque el panel muestra las
  cuentas de los dispositivos; los nombres de los estados de EE.UU. (sin tabla, se saltean); y la captura del «después» en el
  ws3 (el permiso de esta sesión no deja abrir el ws3 en producción).

## «Tus cuentas de IA» más corto: la estructura de tres apps, copiada de su ayuda pública (24/10/2026)

**El pedido** (Martín, por el Cerebro): «mejora el diseño del modal de "Tus cuentas de IA", esta bastante feo, mucha información,
mucho scroll...». El Cerebro: no diseñarlo de cero, copiar la ESTRUCTURA de una app de referencia y, si se usa la documentación,
decir cuál y que es la documentación.

**Vive en:** `app/integraciones/CuentasYDispositivos.tsx` (las filas de ventana y de dispositivo, `NuevoDispositivo`, la descarga) ·
`TusCuentasIA.tsx` («Nueva cuenta», el esqueleto, la destacada de /integraciones) · `tus-cuentas-ia.css` · `app/admin/operaciones/Uso.tsx`
y `UsoCredito.tsx` (lo del super admin) · `centro.css` («El Uso en filas») · `tests/tus-cuentas-ia-diseno.test.ts`.

- **La estructura salió de la AYUDA PÚBLICA, no de las apps.** No había ningún navegador con sesión. La revisión obligó a nombrar el
  artículo exacto y a separar lo que es nuestro:
  - «Usage limit best practices» (support.claude.com) da una barra por ventana, con el tiempo que le queda a la sesión y cuándo se
    reinicia la semana. El % y el renglón único no están en esa ayuda: son lo que el Uso ya copiaba de claude.ai el 16/10;
  - «Ver dispositivos con acceso a la cuenta» (support.google.com) da cada dispositivo con nombre, lugar y estado, y al tocarlo
    «Salir». Google abre otra página; acá se abre en el lugar;
  - «Manage and optimize usage» (vercel.com/docs) da lo consumido por recurso y el detalle aparte. Que la fila de la API se abra en
    el lugar es nuestro.
- **«Nueva cuenta» arriba era una decisión de Martín** (23/10, más arriba en este documento), no un descuido. La sugerencia de bajarla
  chocaba con eso: quedó arriba, en una fila con botones chicos, y las tarjetas grandes sólo sin nada conectado.
- **«Nuevo dispositivo» con la descarga a la vista (23/10) se REEMPLAZÓ el 24/10.** Martín: «no el botón feo que está al final del
  modal que no lo ve nadie». Ahora es una fila discreta que abre el tutorial en la descarga. La descarga para quien no tiene la
  app vive en el cartel del chat (docs/hallazgos-operaciones.md). La pieza de la descarga (`DescargarMaKo`, `avisoAlAbrir`,
  `DescargarElOtro`) sigue siendo de IA del cliente.
- **Lo que avisa no se pliega.** La revisión lo encontró dos veces: «sin crédito» y un plan al 90% quedaban adentro del pliegue de
  la API, detrás de un total que se veía sano, y el negocio que usa ese crédito (el de Mauricio) se quedaba sin contestar. Ahora
  dejan su línea afuera, junto al interruptor y a «No pude leer las claves». **La regla está en AGENTS.md.**
- **El foco se perdía al pedir confirmar «Desconectar».** La pregunta reemplaza al botón, y con el botón se iba el foco al `<body>`.
  Ya pasaba antes del rediseño. Ahora el foco va a «Cancelar» y, al cancelar o si falla, vuelve a «Desconectar».
- **El marcado no cambió de orden, lo acomoda la grilla** (`display: contents` en la fila de adentro). Seis tests leen el texto de
  cada tarjeta del Uso en orden, y un lector de pantalla sigue diciendo «Semana, 47% usado, se reinicia…». La columna del % lleva
  un mínimo (`minmax(6.5rem, auto)`): con `auto`, cada renglón medía la barra por su texto y la lista quedaba dentada.
- **El esqueleto (IA16, 23/10) tiene la forma del bloque nuevo.** Si no, al llegar el estado, todo saltaba.
- **Medido** con las piezas reales en un Edge sin ventana (4 cuentas de Claude Code, 1 dispositivo y la API cerrada): **de 2.155 px a
  1.187 px**. No es producción.

**SIN hacer:**
- Que Martín lo abra en producción.
- La fecha de reinicio en el bloque del cliente sale en el idioma del navegador (`cuandoSeReinicia`): en uno en inglés dice «el Oct
  28», mientras la del super admin dice «el mié 28» (`textoReinicio`, lib/centro-uso.ts).
- En Safari, un nombre de cuenta largo queda en tres renglones al lado del Runner.

## Firmar Windows DESDE ESTA PC con CodeSignTool (SSL.com eSigner), listo antes del certificado (23/10/2026)

**El porqué:** no hay empresa registrada, y Azure Artifact Signing sólo acepta empresas de algunos países (a una persona, sólo
en EE.UU. o Canadá). Va SSL.com IV a nombre de Martín. El Cerebro: «la firma con CodeSignTool desde esta PC, sin Actions.
Así cuando le aprueben el certificado, la 0.4.x sale firmada sin más trabajo».

**Vive en:** scripts/ia-pc/firmar-windows.mjs · publicar-binarios (`firmaDeEstaPc`, `FIRMAR`, `firmar`) ·
tests/ia-pc-firma.test.ts · los pasos de Martín en docs/plan-instalador-escritorio.md › «Firmar: lo que hace Martín».

- **Las trampas de CodeSignTool** (su guía, 23/10):
  - Sin `-output_dir_path` PISA la entrada y PREGUNTA antes: desde un script se queda esperando. Va una carpeta aparte, la
    entrada cerrada (`input: ''`) y un reloj.
  - Sus códigos de salida no están documentados, y «Error: invalid otp» sale como texto. «Firmado» es que el .exe que vuelve
    TENGA la tabla de certificados del PE (el directorio 4) y la marca de tiempo, no que la herramienta salga con 0. Sin la
    marca de tiempo, la firma vence con el certificado, al año.
  - En Windows es un `.bat`. Desde abril de 2024 Node no corre un `.bat` sin `shell: true`, y por la consola una clave con `&`
    o `"` se rompe. Por eso se corre su Java con su .jar, desde su carpeta (lee `conf/` de ahí).
  - El error de `execFileSync` trae la línea de comandos ENTERA, con `-password=`. Se usa `spawnSync` y se tapa lo que conteste.
- **Las claves NO van en el .env.local del clon:** está en el Escritorio, y OneDrive lo sube a la nube. Con el usuario, la
  clave y el secreto TOTP, cualquiera firma a nombre de Martín. Van en `%USERPROFILE%\.mako-firma.env`, y publicar-binarios
  corta si encuentra `SSL_COM_CLAVE` o `SSL_COM_TOTP` en el .env.local.
- **Cada firma cuesta:** el plan 1 de eSigner trae 240 por año, y una versión gasta 2. En seco no se firma (`--probar-firma`
  para probarla), y al aplicar, si la firma falla, se corta ANTES de subir nada.
- **El orden:** la firma cubre la cabecera, así que va DESPUÉS de `marcarDeVentana` (marcar después la rompe). Va ANTES de
  Inno: si no, el setup lleva el programa sin firmar. El setup se firma después de Inno y antes de subirlo.

### Lo que quedó SIN hacer
- **Sin probar con la herramienta de verdad,** porque no hay certificado: 28 roturas dan rojo, pero contra una CodeSignTool
  de mentira. La primera vez: `--probar-firma` en seco, y mirar Propiedades › Firmas digitales del setup. Si CodeSignTool no
  pone la marca de tiempo sola, el script corta.
- **El desinstalador de Inno (`unins000.exe`) queda sin firmar.** Firmarlo pide la directiva `SignTool` de Inno, con el
  comando en la línea de ISCC, que lo imprime con la clave. No baja de internet (no tiene la marca de la web), así que
  SmartScreen no lo revisa.
- **La Mac:** su firma está en la entrada de abajo.
- `buscarCodeSignTool` supone la carpeta del .zip de Windows de hoy (`jar/code_sign_tool-*.jar`, `jdk-*`). Si SSL.com la
  cambia, el script dice qué no encontró.

## Firmar y notarizar la Mac DESDE ESTA PC (Developer ID + rcodesign), listo antes del certificado (23/10/2026)

**El porqué:** Martín abre Apple Developer individual a su nombre (02:17: «Sí, a mi nombre ahora»). El Cerebro: «Dejala
preparada como la de Windows, con sus pasos y sin probar hasta tener el certificado».

**Vive en:** scripts/ia-pc/firmar-mac.mjs · `esLaAppDeMac` y `copiarLaAppAlArranque` (scripts/ia-pc/mako-pc.mjs) ·
publicar-binarios (`firmaMacDeEstaPc`, `FIRMAR_MAC`) · tests/ia-pc-firma-mac.test.ts · los pasos de Martín en
docs/plan-instalador-escritorio.md › «Firmar la Mac: lo que hace Martín».

- **Las firmas que traen los ejecutables de Bun están VENCIDAS** (medido con Bun 1.2.21 armando en esta PC, hash por hash):
  - el de arm64 trae una firma local del linker que no coincide en la última página;
  - el de Intel trae la de Oven, rota en dos páginas: la cabecera y la de `__BUN`, donde Bun mete el programa.
  Sin una firma nueva, el chip de Apple no lo corre. La firma local que pone el lanzador de la app sin firmar
  (`codesign --force --sign -`) NO es opcional.
- **Bun guarda el programa en una sección propia (`__BUN,__bun`):** firmarlo después no lo rompe, y un universal anda.
- **Firmada, la app no puede tener un guion como ejecutable.** La firma de un guion vive en atributos extendidos, y un .zip
  no los guarda. Va UN Mach-O universal (Intel y Apple, armado en JS como `lipo -create`, alineado a 16 KB) en
  Contents/MacOS/MaKo. Al abrirse, se copia a ~/.mako-pc/bin sin cuarentena. Nunca le pone la firma local: pisaría la de
  Apple.
- **Sin Mac, se firma y se notariza con rcodesign** (indygreg/apple-platform-rs, trae .exe de Windows):
  - `sign --for-notarization` exige el Developer ID, la marca de tiempo y el hardened runtime;
  - los entitlements de Bun (el JIT) van aparte;
  - `notary-submit --staple` deja el ticket en Contents/CodeResources, que se zipea con lo demás.
- **«Firmado» se lee como la Mac** (`problemasParaNotarizar`), no por el código de salida, y se mira ANTES de notarizar. En
  las dos rebanadas: cada página contra su hash (la última, parcial), la firma CMS del certificado (una local no la trae, o
  la trae vacía), la marca de tiempo, el runtime y el JIT.
- **La trampa del test:** la guarda de OneDrive «pasaba» sin la guarda. El camino de prueba (`C:\Users\m\OneDrive\x`) no
  existía, y el error de permisos al crearlo también decía «OneDrive». Se prueba con una carpeta temporal que tiene OneDrive
  en el camino, y con el mensaje entero.
- **El tamaño:** el universal comprimido mide 48 MB; Supabase corta en 50.

### Lo que quedó SIN hacer
- **Sin probar en una Mac ni con Apple:** no hay certificado ni Mac. Los primeros intentos de notarizar suelen fallar
  (rcodesign recomienda tener antes una prueba con las herramientas de Apple). Falta ver que macOS deje abrir el universal
  de Bun con el runtime y que la copia corra desde el arranque. Lo mira el log de `notary-log`.
- **La línea de «Abrir igualmente»** (`AVISO_GATEKEEPER`) se saca de la pantalla en la versión que salga firmada.
- **El margen de 2 MB** con el tope de Supabase: si el programa crece, el .zip de la Mac no entra.

## MaKo.app: la Mac SIN Terminal (0.4.2, 23/10/2026)

**El porqué:** en la llamada del 23/10 (Fathom 195591907), Mauricio conectó su MacBook por la Terminal y le costó («No abrió
nada», «escribí S y apretá Enter»). El Cerebro: el mismo criterio que Windows, sin firmar por ahora, con la línea de cómo
abrirla si macOS la frena.

**Vive en:** `abrirLaApp`, `codigoDelTexto`, `instalarArranqueMac` e `instalarClaudeCode` (scripts/ia-pc/mako-pc.mjs) ·
`lanzadorDeLaAppMac` e `infoPlistDeLaAppMac` (lib/ia-pc-reglas.ts) · scripts/ia-pc/zip-unix.mjs · publicar-binarios · GET
/api/ia-pc/descargar?os=mac · tests/ia-pc-mac-app.test.ts.

- **Dos cosas que en Windows salen solas y en la Mac no:**
  - Un `.pkg` o un `.dmg` no se arman en Windows: pkgbuild y hdiutil son sólo de Mac, y Actions no tiene minutos. Va un `.zip`
    con MaKo.app.
  - En la Mac un enlace `mako://` le llega a la app como un evento de macOS (Apple Event), no como argumento, y un programa de
    Bun sin Cocoa no lo recibe. El código lo toma la app del PORTAPAPELES (sólo si es el código entero: cualquier otro texto, no)
    o lo pide en una ventana.
- **Un `.zip` armado en Windows no guarda los permisos de Unix,** y sin el permiso de ejecución la app no abre.
  scripts/ia-pc/zip-unix.mjs lo arma «hecho en Unix», con 0755 en el lanzador y en los programas. Verificado con el `unzip` del
  sistema y con la app real de 47,6 MB.
- **La app es un guion que copia el programa a ~/.mako-pc/bin,** le saca la cuarentena y le pone la firma local que pide el chip
  de Apple (lo mismo que hace la línea de la Terminal). Así macOS sólo pregunta por la app, que no está firmada: «Abrir
  igualmente». El arranque es el MISMO LaunchAgent de la Terminal, y una Mac conectada así (la de Mauricio) no cambia.
- **SIN probar en una Mac de verdad,** porque no hay ninguna acá: que macOS deje abrir una app sin firmar cuyo ejecutable es un guion,
  que `osascript` muestre las ventanas desde una app sin Dock y que `install.sh` corra sin Terminal. La firma de Apple espera
  el D-U-N-S.

## «Conectar mi computadora» en Windows SIN terminal: el instalador con asistente y la sesión de Claude (0.4.0, 23/10/2026)

**El pedido** (Martín, 22/10, y su OK del 22/10 23:21 por el Cerebro): «jamás por Powershell, ni siquiera que se tenga que
abrir… el típico panel de "avanzar"… Que al darle conectar si no tenes instalada la app, te deje descargarla»; «la 0.4.0 sin
firmar», con UNA línea para el aviso de Windows y la de PowerShell sólo como respaldo escondido.

**Vive en:** installer/windows/mako.iss · scripts/ia-pc/publicar-binarios.mts (arma el instalador con Inno) · GET
/api/ia-pc/descargar · el tutorial de app/integraciones/TusCuentasIA.tsx (Windows: tres pasos) · `RUTA_TRAS_INSTALAR`
(/perfil/ia?computadora=1) · `iniciarSesionDeClaude` (scripts/ia-pc/mako-pc.mjs) · tests/ia-pc-instalador-040.test.ts y
tests/ia-pc-login-sin-terminal.test.ts.

- **El diagnóstico obvio era el equivocado: la terminal escondida era el LOGIN de Claude, no el instalador.** Instalar sin
  consola se resuelve con Inno. Pero sin consola `claude auth login` no termina solo: imprime la URL y espera que le PEGUEN
  el código por stdin (medido el 23/10 con una carpeta de Claude de prueba: un código falso da «Login failed … 400» y sale
  con 1). Correrlo oculto deja a la persona sin dónde pegarlo. La salida: el programa sirve una página LOCAL (127.0.0.1, con
  un secreto en la ruta, que contesta sólo a su dirección y acepta el envío sólo desde ella), y el código va directo al
  stdin de `claude`. **Nunca pasa por MaKo:** un tercero no puede tocar las credenciales de la suscripción.
- **GitHub Actions se quedó sin minutos el 22/10:** el instalador se arma en esta PC, con Inno Setup 6 por usuario (winget,
  con el hash del instalador oficial verificado). publicar-binarios lo busca en %LOCALAPPDATA%\Programs\Inno Setup 6, o
  en `ISCC=`.
- **No se probó INSTALÁNDOLO en esta PC, y no hay que hacerlo:** acá corre `mako-pc.exe` como la computadora conectada al
  ws1 (la de Martín en la cuenta de Mauricio), y el instalador la cierra al actualizar (CloseApplications). La prueba de punta
  a punta va en una computadora de prueba con el ws3 (la parte 7 del plan).
- **Al actualizar, la app quedaba apagada** hasta el próximo inicio de sesión: el instalador la cerraba y nadie la volvía a
  abrir. Ahora la arranca al terminar; sin conexión guardada, sale sola.
- **/conectar-mi-computadora nunca existió:** el instalador vuelve a /perfil/ia?computadora=1, que ve toda persona del
  negocio, directo en «Conecta MaKo» y con las PC de antes YA leídas. Si no, una que ya estaba en línea se tomaba por la
  nueva y decía «¡Listo!».
- **Claude Code lo instala el instalador con un PowerShell OCULTO** (el instalador oficial de Anthropic; la persona no abre
  nada) y sin la barra de progreso, que en PowerShell 5.1 vuelve lentísima la bajada.
- **La 0.4.0 publicada NO servía: la página local rechazaba su propio formulario** (revisión de Integración, 23/10; arreglado
  en la 0.4.1). La página salía con `Referrer-Policy: no-referrer`, y con esa política el navegador manda el POST de la MISMA
  página con `Origin: null` (lo dice la especificación Fetch; medido en Chromium 152). El chequeo «Origin igual al mío» daba 403
  en blanco al pegar el código. El test no lo vio porque ponía el Origin A MANO. Ahora usa `same-origin` y el test manda el
  Origin que mandaría un navegador según la política de la página. **La regla: un test de un formulario manda los encabezados
  que deriva el navegador, no los que uno supone.**
- **El Setup de Inno es de 32 bits**, y sin `ArchitecturesInstallIn64BitMode` el PowerShell oculto salía de SysWOW64.
  install.ps1 corta con «does not support 32-bit Windows» si el proceso no es de 64 bits (medido el 23/10), así que Claude Code
  no se instalaba en NINGUNA computadora, y en silencio. La 0.4.1 instala en modo 64 bits, sin preguntar (`-NonInteractive`), y
  arranca la app antes de instalar Claude Code.
- **El aviso del chat sin sesión mandaba al «paso 3»,** que en Windows ya no existe. Ahora dice «desde Tus cuentas de IA», y
  la línea de comandos queda plegada para las PC de la 0.3.2, como la del ws1, que no abren `mako://`.
- **SIN hacer:** el `.pkg` de la Mac (la Mac sigue con la Terminal), la firma (lo decide Martín: nota firma-codigo-2310 en
  las notas del Cerebro), `agregar-cuenta` todavía abre una consola (`stdio: 'inherit'`, en mako-pc.mjs), y la prueba de
  punta a punta en una computadora de verdad.

## «Conectar mi computadora» sin PowerShell: el enlace mako:// y la ventana del sistema (22/10/2026)

**El pedido, textual** (Martín): «el proceso de instalación jamás sea por Powershell, ni siquiera que se tenga que abrir, que
sea una app de escritorio con el típico panel de "avanzar"». El plan entero: docs/plan-instalador-escritorio.md.

**Vive en:** `conectarDesdeEnlace`, `codigoDelEnlace` y `ventana` (scripts/ia-pc/mako-pc.mjs) · installer/windows/mako.iss
(borrador) · tests/ia-pc-enlace.test.ts.

- **Del enlace sale SÓLO el código.** Cualquier página puede abrir un `mako://`. Con el servidor en el enlace, un sitio se
  llevaría la computadora, y con ella la suscripción de Claude de la persona, a su MaKo. La app usa siempre el suyo, y la
  ventana dice a qué negocio y como quién se conecta, como el «¿Es tu negocio?» de la consola.
- **La ventana es del sistema, sin consola:** `MessageBoxW` de user32 con `bun:ffi` dentro del ejecutable (probado con Bun
  1.2.21 sin mostrarla: el texto en UTF-16 llega entero), y `osascript` en la Mac. Sin poder mostrarla, es «no».
- **Si MaKo no confirma, se suelta lo pendiente** (como con el «no»). La primera versión lo dejaba guardado; lo mostró el
  hijo del test.
- **Lo que dice la doc de Claude Code** (leída el 22/10): `claude auth login` es el login oficial (abre el navegador, pero
  la doc lo describe en una terminal); `claude auth status` sale 0 o 1 sin gastar; `claude setup-token` NO se usa (un tercero
  no puede guardar tokens de la sesión). Que el instalador oficial ande oculto no está confirmado.
- **⚠️ Para Martín:** los términos de Anthropic no dejan que un tercero «route requests through … Max plan credentials on
  behalf of their users», y excluyen al que entra «with their own Claude subscription» en el Claude Code sin modificar. La
  doc no dice de qué lado cae MaKo en la PC del cliente (D6a) y manda a preguntar a ventas.
- **La revisión adversarial del enlace (Integración, 22/10) encontró que la ventana EMPUJABA al «Sí»:**
  - **«Sí» era el botón por defecto**, en una ventana que se lleva el foco: una página que abre el enlace mientras la persona
    escribe se lo llevaba con un Enter. Ahora es «No» (`MB_DEFBUTTON2`; en la Mac, `default button 1`).
  - **Ante el código de OTRO negocio decía «Tu Ops Center va a contestar con tu Claude»**, que ahí es falso, y el reemplazo
    iba en el tercer párrafo. Es el caso del phishing: otro cliente de MaKo pide su código y manda el enlace. Ahora lo
    primero es «Esta computadora hoy usa tu Claude para «A». Si sigues, lo va a usar «B»… y «A» se queda sin él».
    **La regla: en una ventana de consentimiento, lo que la persona pierde va primero, y el texto nunca habla como si lo
    ajeno fuera suyo.**
  - **Dos enlaces a la vez:** el segundo soltaba el pendiente del primero, y el «Sí» de la primera ventana confirmaba el de
    la otra con el cartel equivocado. Ahora sólo se contesta si lo pendiente sigue siendo el de esa ventana.
  - **Una configuración de la 0.2.0** (con token y sin el negocio) se reemplazaba sin aviso: ahora también avisa.
- **SIN hacer:** armar el instalador (Inno Setup no está en esta computadora; GitHub Actions lo trae), la pantalla nueva
  (abrir o descargar) y la página `/conectar-mi-computadora` que abre mako.iss al terminar (no existe), Claude Code sin
  terminal, el `.pkg` de la Mac, la firma (cuesta plata: lo decide Martín) y subir `VERSION` y `VERSION_PC` a 0.4.0 JUNTOS
  en el commit del instalador (un test los ata; con su OK). ⚠️ Hasta entonces, nadie corre `publicar-binarios` desde main:
  sube con `upsert: true` y pisaría la 0.3.2 publicada.
- **Sin decidir:** en modo enlace, ¿no reemplazar una conexión a OTRO negocio y pedir que se desconecte primero desde
  MaKo? Es más fuerte contra el phishing y cuesta un paso al que cambia de negocio de verdad.
- **Sin medir (de antes):** `pensar` corre `claude -p` sin `--setting-sources`; si eso carga el `~/.claude/CLAUDE.md`
  personal de la persona, un negocio podría pedirle en un turno que lo repita. Se mide con un turno de prueba.

## Con qué IA corre UN chat: el «+» de la caja (8b, 23/10/2026)

**El pedido** (Martín): «En el Ops Center, el "+" de la caja deja elegir con qué corre ese chat: el modelo y la cuenta (Claude
o GPT, y cuál). Por defecto decide el chat jefe, salvo que se elija otro». El selector es de Ops Center (lib/chat-ia-reglas.ts y
la caja); el servidor, de la IA del cliente.

**Vive en:** `cuentasDeIA` y `eleccionDelPedido` (lib/chat-ia.ts) · GET /api/mako/chat?suIA=1 y las dos ramas del POST · el
campo `ia` de `turnoApp` (lib/mako-turno-app.ts) · `soloSuClaude` con `modeloSuClaude` y `soloSuOpenAI` (lib/anthropic.ts) ·
tests/chat-ia.test.ts.

- **La elección se valida en la RUTA, contra lo que se le ofrecería AHORA,** no en el turno ni en el navegador.
  `eleccionDelPedido` sanea lo que llega (`sanearIA`) y lo cruza con `cuentasDeIA`, así que una cuenta que ya no está, o la
  computadora de otra persona, vuelven a Automático. El turno confía en esa validación.
- **La plata la sigue cuidando la puerta 2:** con el crédito de Claude de MaKo, pedir Sonnet sale en Haiku igual
  (`evaluarClaveDelNegocio`), y por eso el crédito se ofrece con `soloHaiku`. Medido con el arnés: la llamada sale en Haiku y
  con la clave del crédito.
- **Elegir una cuenta es elegirla:** con la computadora elegida, el turno no cae a las claves; con SU OpenAI, no cae a Claude
  (`soloSuOpenAI` tira «falló la IA»). Automático sigue igual que antes: la computadora y, si no puede, sus claves.
- **La revisión adversarial (Integración, 23/10) agarró una decisión que se abría por otra puerta:** el modelo de la clave
  PAGA del negocio lo elige el admin (la ruta del modelo le contesta 403 a un miembro), y el selector se lo dejaba elegir a
  cualquiera. Ahora a un miembro no se le ofrece elegir modelo en su Claude, y corre con el del admin. **La regla: una decisión
  que una ruta le cierra a un rol se le cierra también en cada puerta nueva que la ofrece.**
  - En su computadora sí elige: gasta el cupo de SU propia suscripción.
  - Con «Tu Claude» elegido y la PC apagada, el aviso hablaba de la computadora y se perdía el error de su clave.
  - Si las cuentas no se pueden leer, la elección vuelve a Automático sin avisar. Es el contrato acordado, y la plata es
    siempre del negocio.
- **Un test que busca «la PRIMERA llamada a la cascada» se equivoca cuando aparece otra antes:** anthropic-tools-sin-fallback se
  ancló a la cascada del registro.
- **Dos tests fallaron SÓLO en la corrida grande** (chats-mako-envio, doer-recetas-video-imagen): pasan solos, en main y en esta
  rama. Fue la carga, no el cambio.
- **SIN hacer:** OpenAI todavía sin elegir el modelo (`MODELOS_DE_LA_CUENTA.openai = []`); el chat del teléfono (/api/m/mako)
  no lee `ia` (el selector va en la caja del Ops Center, que usa /api/mako/chat).

## La computadora del cliente NUNCA atiende leads sola (Martín, 22/10/2026)

**La decisión, textual** (Martín, sobre los términos de Anthropic con la suscripción en la PC del cliente, D6a): «No por
ahora». La PC se usa SÓLO para que cada dueño trabaje con su propio Claude; NUNCA para atender leads solos, las 24 horas: ni
respuestas automáticas de WhatsApp, ni AI Steps de Automations, ni nada que corra solo hacia un lead. Ésos van por clave de
API, o por el crédito donde está asignado.

**Vive en:** `encolarTurno` (lib/ia-pc.ts) · `turnoApp` (lib/mako-turno-app.ts) · tests/ia-pc-nunca-a-leads.test.ts · AGENTS.md.

- **Medido el 23/10/2026: no había nada que cerrar.** Un solo lugar crea turnos de PC (`encolarTurno`), lo llama un solo
  lugar (`turnoApp`), y a `turnoApp` lo llaman cuatro entradas, todas con la sesión de una persona adentro: el chat de la app
  (app/api/mako/chat), el del teléfono (app/api/m/mako), el de MaKo en el CRM (app/crm/mako-crm/chat-server.ts) y el Analyst
  de la ficha (lib/mako-analyst-lead.ts). Lo que proponen se confirma en una tarjeta. WhatsApp, Automations y los crons tienen
  su propio motor y no importan lib/ia-pc.
- **El riesgo era el de mañana, no el de hoy:** una entrada nueva que llamara a `turnoApp` desde un cron o un webhook
  mandaría el turno a la PC sin que nada lo marcara. El guardián lo cuenta: quién toca la PC, quién llama a `turnoApp` y
  con qué sesión. Probado rompiéndolo: un cron, un webhook, otro insert de turnos, el Analyst sin la sesión y la prueba a
  mano sin el corte del ws3, los cinco en rojo.
- **La excepción es a mano:** scripts/ia-pc/probar-punta-a-punta.mts llama a `turnoApp`, y se acepta porque nadie la
  programa y se niega fuera del ws3.

## Varias computadoras por persona, «Desconectar» y el panel del super admin (22/10/2026)

**El pedido, textual** (Martín): «el usuario debería poder abrir y ejecutar su Claude en varios dispositivos, por ejemplo,
ahora abrí la cuenta de Mauricio e instalé MaKo desktop para conectarme a su claude, pero luego él va a querer hacerlo en su
PC, se debería poder ver eso... Lo mismo en SuperAdmin. Y poder "Desconectar" dispositivos».

⚠️ **Lo de «Lo mismo en SuperAdmin» CAMBIÓ el 23/10/2026:** al ver las de todos en «Tus cuentas de IA», Martín: «estas cruzando
workspace». Las de un cliente van ahora en su ficha (Clientes → Equipo) y no queda una lectura de todos los negocios:
docs/hallazgos-operaciones.md, «Las computadoras de los clientes…».

**Vive en:** `elegirPc`, `sistemaDeLaVersion`, `detalleDeLaPc` (lib/ia-pc-reglas.ts) · `pcDe`, `listarPcDelNegocio` (lib/ia-pc.ts)
· app/admin/ComputadorasDelNegocio.tsx (la ficha del cliente en Clientes; hasta el 23/10, SuperAdmin › Uso) · «Conectar otra computadora» en
app/integraciones/TusCuentasIA.tsx · tests/ia-pc-varias.test.ts.

- **Medir antes de construir: casi todo ya estaba.** Una persona ya podía tener varias computadoras (nada lo impedía), la
  tarjeta ya las listaba con «Desconectar», y `desconectar` ya revocaba al instante y vencía el turno en curso. Conectar otra
  no suelta las demás (sólo reemplaza la anterior de la MISMA máquina): la que Martín conectó en la cuenta de Mauricio no se
  pierde.
- **Lo que estaba mal era a cuál iba el turno:** `pcDe` tomaba «la que latió último». Con dos prendidas, cada latido (30 s)
  ganaba otra, y el turno saltaba de un Claude a otro. Ahora va a una que conteste; con varias, a la que contestó el último
  turno; sin turnos, a la última conectada; si una se apaga, a la otra.
- **El sistema sin migración:** el programa desde la 0.4.0 manda `0.4.0+windows` o `+mac` en la versión del latido (el campo
  ya aceptaba el `+`). Las de antes no lo dicen, y no se muestra.
- **La computadora desconectada lo dice** en una ventana del sistema, desde la 0.4.0 (rama instalador-escritorio-2210). Antes
  sólo quedaba en el registro, que nadie lee en un programa sin consola. La ventana va al final y esperada: si no, el
  programa salía antes de mostrarla.
- **Trampa de la rotura:** «leer el hash y no devolverlo» quedó en verde, y estaba bien: no es una fuga. La rotura que sí lo
  devuelve da rojo. Una rotura que no rompe nada no prueba el test.
- **El panel del cliente** va dentro de `<TusCuentasIA />`, que el Uso del cliente (D3, chat Ops Center) ya abre tal cual.
- **La revisión adversarial lo encontró: «la del último turno» se queda pegada a una que FALLA.** Con sólo los turnos
  contestados bien, una PC que llegó al tope o se colgó pero sigue latiendo era «la del último turno» para siempre: cada
  turno iba ahí a fallar y la otra, que contesta, no recibía ninguno (antes, con «la que latió último», al menos se
  turnaban). El arreglo: el último turno TERMINADO (bien, error o vencido); la que falló, o tiene todas sus cuentas al 100%
  (`cuentasAgotadas`), va al final, y entre las que fallaron primero la que falló hace más. **La regla: elegir «la última
  que anduvo» sin mirar si anduvo bien convierte una preferencia en una trampa.**
- **«Desconectar» se apoyaba en que un update no fallara.** `desconectar` revocaba la PC y vencía sus turnos en dos pasos, y
  el segundo podía fallar callado; `pedirLlamada`, `esperarALaPc` y `tomarTurno` miraban el estado del TURNO, no la PC.
  Ahora el segundo paso tira, y las tres miran `revocado_at` (`sigueConectada`, falla cerrada). **La regla: toda puerta que
  da un turno o corre una herramienta mira la revocación de la PC, no sólo el estado del turno.**
- **El email de Claude de un empleado va enmascarado (decidió el Cerebro, 22/10):** el admin ve de cada computadora de su
  equipo el nombre, de quién es, si está en línea, el plan y el % de uso (para manejar la capacidad), y el email como
  `m***@gmail.com`; entero, sólo el dueño de esa computadora y el super admin (`puedeOperar`). Se enmascara en el SERVIDOR
  (`cuentasParaVer` en GET /api/ia-pc/estado, que leen la computadora y el teléfono): enmascararlo en la tarjeta dejaba el
  email entero en la respuesta. Si no se puede saber si es el super admin, enmascarado. tests/ia-pc-email-enmascarado.test.ts.
- **Quedó SIN medir:** si el programa sigue mandando la cuenta en el latido cuando la sesión de Claude venció. Si la manda,
  esa PC cuenta como «usable» hasta que falla un turno (después, el arreglo de arriba la manda al final).

## D6b para TODO el negocio: la decisión baja a la PUERTA de la capa de IA (IA6, 22/10/2026)

**Vive en:** `lib/solo-su-ia.ts` (`conD6bDelPedido`, `esFueraDeD6b`) · la primera línea de cada función pública de
`lib/ai-cheap.ts` y de `chatClaude`/`chatClaudeTools` (lib/anthropic.ts) · `tests/d6b-puerta.test.ts` (corre las entradas a
pelo) · `tests/d6b-rutas.test.ts` (la tabla quedó para lib/transcribe.ts)

- **Síntoma:** D6b se prendía sólo donde quien atendía el pedido lo prendía (el turno del Ops Center y sus pantallas). El
  ws11, con su Claude y su OpenAI, corrió el simulador del Chat Agent con Groq y OpenRouter el 21/10 a las 20:51 UTC, con
  D6b ya desplegado; su plan-fathom y su Perro, con Gemini. La tabla `FUERA_DE_D6B` tenía ~90 prefijos «decididos afuera».
- **El diagnóstico obvio era el equivocado:** prender `conSuIADelNegocio` en cada cron, webhook y tab. Son ~370 entradas que
  llegan a la cascada, y la próxima que se agregue no lo haría. El corte ya vivía abajo (`provDe`, la red, el orden por
  cuota); lo que faltaba bajar era la DECISIÓN. Ahora cada función pública de la capa de IA, si nadie decidió antes, decide
  con el workspace del pedido (`negocioConSuIA`, con 60 s de memoria por negocio). Las excepciones son de Martín y viven en
  la puerta: las funciones del Plan (`FEATURES_DEL_PLAN`) y la plataforma (y lo que corre sin workspace).
- **Con su IA, la cascada es SU IA aunque el que llama pida otra lista.** Una función «que no se degrada» (`fallback: []`)
  atada a Gemini, con D6b, no corría con NADA y fallaba; ahora corre con su Claude (primero) y su OpenAI.
- **Las fotos, con su Claude:** `leerDocumentoIA` prueba primero la clave de Claude del negocio con la imagen o el PDF como
  bloques (antes, con sólo su Claude, una foto era «no puedo»).
- **Trampas de la guarda:** (1) el detector de «prende» sigue llamadas, y como cada función de la capa de IA llama a la
  puerta (que llama a `conSoloSuIA`), TODO «prendía»: la puerta se excluye del detector. (2) El control de
  tests/d6b-confirmar.test.ts era «la misma ejecución, a pelo» y suponía que a pelo salía a Gemini: con la puerta ya no; el
  control ahora decide afuera a mano. (3) Sacar la puerta de `leerDocumentoIA` no da rojo, y está bien: adentro usa
  `provsDe` y la red, que tienen la suya.
- **Contracara, medir:** falla cerrada en todo: si la base no contesta, un negocio sin su IA pierde su Gemini en ESE pedido
  (hasta 60 s, por la memoria). Y el ws10 corre TODO con la clave de Claude que es el crédito de Max de Martín: medir su gasto
  una semana después del deploy.
- **Sin hacer:** lib/transcribe.ts sigue fuera de la puerta (IA7); el doer de WhatsApp elige proveedores a mano (WA1); los
  `model` explícitos (closing, el escalado del doer) siguen yendo al veto de la plataforma (IA5, IA12). Caso real a medir
  después del deploy: 0 filas de gemini, groq u openrouter del ws11 fuera del Plan en 48 h.

## La OpenAI de MaKo no aparece en `anthropic_usage`: los anuncios se escuchaban con una IA que no se veía (IA7, 22/10/2026)

**Vive en:** `lib/transcribe.ts` (los anuncios y los creativos del negocio, por la capa de IA) ·
`lib/transcribe-plataforma.ts` (los cursos y el Conocimiento de MaKo, con las keys del entorno) ·
`app/api/ads-manager/analyze-creatives/route.ts` · `tests/transcribe-anuncio.test.ts`

- **Síntoma:** en `ad_transcripts`, 55 «vision» y 28 «whisper» con «You have no credits remaining» y 0 OK en 30 días (el
  último, el 21/10 a las 19:33 UTC). Desde el panel de gasto no se veía nada: **la OpenAI de MaKo no aparece en
  `anthropic_usage`**, porque lib/transcribe.ts, lib/embeddings.ts y analyze-creatives no registran uso. Que estaba muerta
  sólo se ve en `ad_transcripts` (o en `mako_knowledge`).
- **Causa:** lib/transcribe.ts era una SEGUNDA cascada de audio con las keys del ENTORNO (Groq → whisper-1 → Gemini, y
  gpt-4o-mini/gpt-4o para estructurar y mirar), fuera de D6b. La usaban los anuncios de cada negocio Y los cursos de MaKo.
- **El arreglo es partirla, no taparla:** lo del NEGOCIO (anuncios, creativos subidos, mirar creativos) pasa por la capa de
  IA (`transcribirAudio`, `chatCheapCascade`, `leerDocumentoIA`) con SUS keys, registrando el uso y con D6b; lo de la
  PLATAFORMA (las clases de los cursos, el Conocimiento) se mudó a lib/transcribe-plataforma.ts. Un llamador nuevo con datos
  de un negocio va al primero. Los anuncios NO van a la red gratis de la plataforma (`pii`) hasta que Martín decida si el
  Groq de MaKo los escucha; sin con qué, la fila dice POR QUÉ (`errorDeCascada`), no «whisper: no credits».
- **Trampa:** `transcribirAudio` no decía quién escuchó; se le sumó `alEscuchar` para que la fila del anuncio lo guarde.
  Y la escucha de la capa de IA no devuelve idioma ni duración (los Whisper de antes sí): esas columnas quedan vacías.
- **Trampa: el `pii` de `transcribirAudio` es FALSE por defecto** (la revisión de la nota de voz del Ops Center, OC7,
  22/10/2026). Una llamada nueva sin él, en un negocio sin su Claude ni su GPT cuyas claves no pueden escuchar, manda el
  audio EN SILENCIO a la red gratis de la agencia (Groq y Gemini; el Gemini gratis entrena), aunque el texto del mismo chat
  nunca vaya ahí. La nota del chat del Ops Center (lib/mako-turno-app.ts → `escucharNotaDelChat`) salió sin él y la frenó la
  revisión. **Regla:** toda nota de voz de una persona del negocio o de un lead lleva `pii: true` (como lib/mako-doer-in.ts y
  el dictado del Plan); sin con qué escuchar, la respuesta dice que conecte la suya (`errorDeCascada`).
- **Sin hacer:** el caso real (regenerar la transcripción de un anuncio del ws11 o del ws14, que tienen OpenAI) espera el
  deploy. `scripts/backfill-transcripts.ts` y `scripts/test-one.ts` ahora necesitan el server: corren con
  `--conditions=react-server` y adentro de `runWithWorkspace` del negocio. lib/embeddings.ts (los vectores del RAG con la
  OpenAI muerta) sigue igual: re-embeber es una migración que decide Martín.

## El negocio elige el modelo de SU Claude, y el crédito de Martín se queda en Haiku (IA5, 22/10/2026)

**Vive en:** `lib/veto-claude.ts` (`CLAUDE_CON_CLAVE_DEL_NEGOCIO`, `MODELO_SU_CLAUDE`, `evaluarClaveDelNegocio` con
`creditosPlataforma`) · `lib/anthropic.ts` (`permisoDeLaClaveDelNegocio`) · `app/api/ia-del-negocio/modelo/route.ts` ·
«Tus cuentas de IA» · `tests/su-claude-modelo.test.ts`

- **Por qué:** con la clave del negocio sólo se podía usar Haiku 4.5, y el Closing Analyst necesita Sonnet (IA12). Ahora el
  admin elige Haiku o Sonnet (`ia.su_claude.modelo`, por negocio); lo paga su cuenta y la frontera (nunca una copia de la
  clave de la plataforma, nunca el Plan) no cambia. Opus no está en la lista a propósito.
- **Trampa que el veto no veía:** la clave «propia» del ws10 es el crédito de Max de Martín (`ANTHROPIC_CREDITO_CUENTA2`).
  El veto compara la clave del negocio sólo contra las copias de `ANTHROPIC_API_KEY`, así que esa cuenta pasa como «del
  negocio». Abrir Sonnet sin mirar eso le daba a Leandro Sonnet pagado por Martín. Ahora la puerta lee las claves del
  crédito: si la del negocio es una de ésas, o si no se pueden leer, va con Haiku aunque elija Sonnet.
- **Sin hacer:** el caso de uso (el closing del ws3 con una clave de prueba) espera el deploy y una clave de Martín. Medir el
  gasto del ws10 una semana después (con IA6 TODO su negocio corre con ese crédito, en Haiku).

## El Closing Analyst con el Claude del cliente: su clave primero, y «vetado» no es lo que lee un cliente (IA12, 22/10/2026)

**Vive en:** `lib/closing.ts` (`analyzeMeeting`, `CONECTA_TU_CLAUDE_CLOSING`) · `lib/anthropic.ts` (`conClaveDelNegocio`
devuelve el modelo) · `tests/closing-su-claude.test.ts` (corre `analyzeMeeting` con el reloj después del 13/11)

- **Por qué:** closing es el único Claude pago de un cliente (123 llamadas, US$13,22 en 30 días, ws9 y ws1), y lo pagaba
  MaKo: la clave del ws1 es una copia de la de la plataforma, y el permiso de Sonnet para closing vence el 2026-11-13.
- **Trampa que había:** el camino pago de `chatClaude` usa `credWs`, que para un cliente CON clave propia devuelve SU clave…
  pero registra el gasto SIN la marca del negocio. Un closing de un negocio con su clave se contaba como gasto de MaKo. Ahora
  `analyzeMeeting` prueba primero la puerta 2 (su clave, el modelo que eligió en IA5, su marca); si su clave falla se dice
  («Tu clave de Claude no pudo…») y NO se cae a la de la plataforma.
- **Regla:** el error del veto es de la plataforma, no del cliente. Vencido el permiso (o una feature fuera de la lista), un
  cliente lee «Conecta tu Claude para el Closing Analyst»; la pausa a mano de Claude se dice como es. La plataforma (ws9)
  sigue con su permiso: renovarlo o no es de Martín.
- **Sin hacer:** el ws1 (Mauricio) sigue analizando con la clave de MaKo hasta el 13/11 (es una copia: la puerta 2 la
  rechaza). Qué pasa después lo decide Martín (pedido al Cerebro). El caso de uso real (una llamada del ws3 con la clave de
  prueba) espera el deploy y la clave.

### Lo que encontró la revisión adversarial de IA5 + IA12 (22/10/2026), y cómo quedó

- **ALTA — «no pude leer» la frontera se leía como «no tiene su clave», y el closing pagaba con ESA clave.** Si no se podían
  leer las claves de la plataforma (`credWsEstricta` tira), `permisoDeLaClaveDelNegocio` devolvía `null`. `analyzeMeeting`
  lo tomó como «sin su clave» y cayó a `chatClaude`, que paga con `credWs`: la fila del negocio. Resultado: Sonnet con
  thinking sobre la clave de un negocio que eligió Haiku, sin su marca en el gasto (contaba como gasto de MaKo); en el ws10,
  sobre el crédito de Max de Martín. Los tests estaban en verde. **Regla:** una puerta que decide plata tiene TRES salidas,
  no dos: «sí», «no» y «no pude saber». Ahora la tercera es `{ noPudeLeer: true }`, y el closing queda en error (lo reintenta
  el cron) sin pedirle nada a Anthropic.
- **Y la puerta 1 (la lista blanca) ya no paga con una clave que no es de la plataforma.** `chatClaude` y `chatClaudeTools`
  exigen que lo que devolvió `credWs` sea una clave de la plataforma (`exigirClaveDeLaPlataforma`). Hoy la lista blanca es
  sólo `closing`, que ya prueba la clave del negocio primero: un negocio con SU clave que llegue ahí es un camino roto, y se
  corta con una fila `vetado:` a US$0.
- **El cron preguntaba otra cosa que el análisis.** `closing-sync` miraba «¿hay una clave?» (`credWs`), y el ws1 (una copia
  de la de la plataforma) iba a pasar después del 13/11 para fallar tres veces por ronda con «Conecta tu Claude». Ahora el
  cron hace la MISMA pregunta que el análisis (`conQueAnalizaElClosing`). **Regla:** el guard de un cron no reimplementa la
  decisión del trabajo: la llama.
- **`in` acepta lo heredado.** `'constructor' in MODELO_SU_CLAUDE` es `true`: guardado así por un POST a mano, el modelo
  salía una función, la puerta 2 tiraba un TypeError que sus llamadores se tragan, y el Claude del negocio desaparecía sin
  aviso con la tarjeta diciendo Haiku. Se valida con `Object.hasOwn` (`esEleccionSuClaude`), en el veto y en la ruta.
- **Una función del Plan con nombre nuevo pagaba IA.** `plan-buscar` (el buscador del tablero) y `cerrar-por-commits` (cron
  sin workspace: cae en el ws1) no estaban en `FEATURES_DEL_PLAN`, y la puerta 2 no exige estar en el catálogo: abierta por
  default. Ahora tests/su-claude-modelo.test.ts barre las features que usa el código del Plan y exige que estén en la lista.
- **El crédito se comparaba contra el entorno O la fila.** Con el entorno puesto, la fila no se leía: una clave rotada en
  la fila (o un entorno viejo) dejaba al ws10 elegir Sonnet sobre el crédito de Martín. Se leen las dos, en la puerta 2 y en
  la tarjeta (lib/su-clave.ts).
- **`esLaPlataforma` sin poder saberlo decía «no».** La plataforma leía «Conecta tu Claude» por un bache. Ahora, sin poder
  saberlo, se dice el veto como es.
- **Trampa de los tests estáticos:** `tests/ia-pc.test.ts` fijaba la cascada del turno con herramientas sin el `soloSuIA()`
  que sumó IA6, y estaba ROJO desde IA6 sin que nadie lo corriera (las corridas de cada paquete eran de sus tests). Un
  cambio en la capa de IA se cierra corriendo TODOS los tests que la nombran, no sólo los del paquete.

**SIN hacer:** `lib/anthropic.ts` → `conCreditoDeLaPlataforma` (la puerta 3, el crédito del onboarding) todavía lee el
entorno O la fila de cada cuenta del crédito, como hacía la puerta 2. Ahí no cambia el modelo (siempre Haiku), sólo con qué
cuenta se paga primero.

## «Conecta tu Claude o tu GPT»: el pedido de «Gemini gratis» vivía en cinco lugares (IA9, 22/10/2026)

- **Dónde estaba:** el mensaje sin IA (`mensajeIAFallo`, lib/ia-mensajes.ts: «con Gemini alcanza»), el botón «Conectar tu
  IA» sin ninguna IA (`SERVICIO_IA` = gemini, lib/mako-turno-app-reglas.ts), el link de WhatsApp (`linkKeysIA`), la visión
  («Carga una API key de Gemini (gratis)»), la cara de marca (lib/persona.ts), las URLs que MaKo repite (lib/hechos-mako.ts)
  y las fichas de /integraciones. Cambiar UNO dejaba los otros cuatro mandando a Gemini.
- **Regla:** el texto de «qué conectar» vive en lib/ia-mensajes.ts (`CONECTA_TU_IA`, `FALTA_TU_IA`) y el destino es su
  Claude (`abrir=anthropic`; desde «Tus cuentas de IA» se llega a su GPT). tests/conecta-tu-ia.test.ts cuenta «con Gemini
  alcanza» en todo app/ y lib/.
- **Sin hacer:** app/dashboard/PanelAnalista.tsx («Una IA gratis (con Gemini alcanza)») es de TB3, que importa
  `FALTA_TU_IA`: el test lo deja como única excepción hasta entonces. El aviso del lienzo de Automations
  (lib/flujo-ia.ts → `falloDeIA`) es de AU3. Las fichas de Cerebras, Mistral y OpenRouter se van con IA8.

### Lo que encontró la revisión adversarial de IA6 (22/10/2026), y cómo quedó

- **ALTA — sin workspace, la puerta se llamaba a sí misma y CONGELABA el proceso.** Devolvía `fn()` sin guardar la decisión,
  y `fn` es la misma función pública, que volvía a preguntar «¿decidió alguien?». Un bucle de microtareas: ni un
  `setTimeout` corría, y el proceso no volvía nunca (una sesión sin negocio, un script, `cookies()` fuera de un pedido).
  **Regla:** una puerta que re-entra a quien la llamó tiene que GUARDAR la decisión antes de re-entrar, siempre, también la
  de «afuera». Lo fija el caso «sin workspace vuelve» de tests/d6b-puerta.test.ts (con un tope de 20 s).
- **MEDIA — el Plan perdía su excepción adentro de otro pedido.** La entrada preguntaba sólo «¿ya decidió alguien?»: un
  `plan-fathom` corrido adentro de una herramienta del doer (que decidió «adentro») usaba la OpenAI del negocio. Ahora
  `pasaPorLaPuerta(feature)` también entra si la función es del Plan y alguien decidió «adentro».
- **MEDIA — «no pude saber» quedaba 60 s.** La falla cerrada de `negocioConSuIA` (la base no contestó) se recordaba: un
  bache dejaba a un negocio sin su Gemini un minuto en todo. Ahora viene marcada `incierto` y la puerta no la guarda.
- **BAJA — leer `soloSuIA()` sincrónico DESPUÉS de una cascada da `false`:** la decisión vive adentro de la cascada y no
  vuelve a quien la llamó. Los dos lectores de afuera (graficos-ia-elemento-server, onboarding) usan `await decidirD6b()`, y
  `errorDeCascada` tiene su puerta.
- **Los tests no veían sacar una puerta** (la de `chatCheap` o `chatCheapTools`): la del nivel de abajo tapaba. La guarda 5
  de tests/d6b-puerta.test.ts exige la puerta en TODA función exportada de lib/ai-cheap.ts y lib/anthropic.ts, con una
  lista cerrada de excepciones con su porqué.
- **Para Martín (no es un arreglo):** un negocio que conectó SÓLO su PC tiene «su IA» (D6b), pero lo de fondo (crons,
  WhatsApp) no puede usar la suscripción (D6a): sin una clave de API, se queda sin IA fuera del Ops Center. Hoy no hay
  ninguno (0 PC conectadas), pero el tutorial tiene que decir que para lo que corre solo hace falta la clave. Y el crédito de
  Claude de la plataforma (sólo onboarding) va antes del corte: en el onboarding de un negocio con su Claude que falla, paga
  Martín.

## Sacar un proveedor de IA: se corta en `provDe`, y su clave pegada se sigue tapando (IA8, 22/10/2026)

Cerebras, Mistral y OpenRouter, medidos en 30 días: Cerebras 0 llamadas (402 en todas sus cuentas), Mistral 74 filas y
TODAS 429 (0 respuestas), OpenRouter 12 llamadas y su modelo gratis caducó tres veces. No daban IA, pero sí costaban:

- **El costo que no se veía era el saldo.** `limitesEfectivos` (lib/ia-cuotas.ts) pedía el saldo de OpenRouter en CADA
  `ordenarPorCuota`, o sea en cada cascada: ~10 de las ~90 consultas de un turno de Offer (docs/hallazgos-infra.md) eran
  para un proveedor que contestaba 12 veces al mes. Un proveedor muerto no se mide por sus llamadas sino por lo que se
  consulta POR él.
- **El tipo no se puede sacar todavía, y no hace falta.** `ProvName` lo nombran las listas del lienzo (lib/flujo-ia.ts, de
  Automations, AU3): sacarlo del tipo rompe un archivo ajeno. La puerta única de las cuentas es `provDe`: con
  `PROVS_SACADOS` devolviendo `null` ahí, ninguna lista vieja ni fila guardada en `credenciales` llega a la red, aunque la
  pida a mano (tests/ia8-sacados.test.ts lo corre con las tres cuentas guardadas en el negocio, la plataforma y el
  entorno). **Regla:** para sacar un proveedor, primero el corte en `provDe`; las listas y el tipo pueden ir atrás.
- **La regla de la clave pegada NO se borra con el proveedor.** lib/claves-en-el-chat.ts sigue tapando `sk-or-…` y `csk-…`,
  sólo sin botón (`servicio: null`). Sin esa regla, una clave de OpenRouter pegada en el chat la agarra la de OpenAI
  (`sk-…`): no sólo quedaría a la vista, el chat le ofrecería «conectarla» como si fuera de OpenAI.
- **Un hijo sin tipos puede pasar en vacío.** La primera versión del test filtraba `p.nombre` sobre
  `provsGratisDePlataforma()`, que devuelve `{ provider, clave }`: `undefined` nunca está en la lista, y el chequeo pasaba
  siempre. Lo vio `tsc` acotado sobre el hijo, no la rotura. Los hijos (`tests/_*-hijo.ts`) no los tipa el test runner:
  pasarlos por `tsc` antes de confiar en un verde.

### Lo que quedó SIN hacer

- `ProvName`, los `case` de `cfgDe`, `LIMITES_PROVEEDOR`, los modelos y timeouts de los tres (lib/ai-cheap.ts,
  lib/ia-cuotas-calculo.ts). Las listas del lienzo (lib/flujo-ia.ts) ya no los nombran (22/10, con el OK de Automations),
  así que lo que queda se puede sacar; hoy es inerte (`provDe` corta). tests/openrouter-modelo.test.ts se va con eso.
- lib/openrouter-saldo.ts sigue: lo lee el panel de gasto (lib/anthropic-usage.ts → `saldoOpenRouter`). Mostrará el saldo
  que quedó; sacarlo es del panel.
- Las filas guardadas en `credenciales` (CEREBRAS/MISTRAL/OPENROUTER_API_KEY) quedan cifradas, inertes y sin botón para
  borrarlas (hallazgos-integraciones, «Sacar una integración»): es SQL, y la Cerebras del ws1 la decide Martín.
- Un negocio con SÓLO Gemini no tiene texto barato: `CASCADA_GRATIS` es `['groq', 'openai']` (ya no tenía Gemini antes de
  IA8). Con IA10 eso deja de importar: el camino es su Claude o su GPT.
## Las claves sin prefijo: Mistral se tapa con contexto, y un regex de tapado no mira hacia atrás en cada posición (22/10/2026)

**Vive en:** `lib/claves-en-el-chat.ts` (las reglas del chat de la app, del grupo de WhatsApp y del acuse del webhook) ·
`tests/doer-claves.test.ts` · `tests/claves-en-el-chat.test.ts` («una línea gigante no cuelga el tapado»)

- **Lo que pasaba entero** (revisión del lote 1): la clave de Mistral (32 alfanuméricos sin prefijo, pegada sin
  `MISTRAL_API_KEY=`), la de Apify (`apify_api_…`, que el producto le pide al cliente) y la de DeepSeek (`sk-` + 32 hex en
  minúscula). Llegaban a la cola, a `mako_doer_conv` y al modelo, y el aviso decía «no la guardé».
- **Una clave sin prefijo es la forma de cualquier id.** Se tapa sólo si tiene mayúscula, minúscula y dígito Y, además,
  «mistral» está a menos de 40 caracteres en la misma línea (antes o después), o el texto es SÓLO eso. Un id de 32 en una
  frase («el pedido … llegó») no se toca: el crudo no se guarda, y lo que se come no vuelve.
- **La primera versión hacía el tapado 20 veces más lento**, y el test de la línea gigante (tope de 2 s por línea) se caía
  bajo carga. El costo era un `(?<=mistral[^\n]{0,40})` que el motor prueba en CADA carácter (~300 pasos por posición), y
  un `(?<=^\s*)` cuadrático con una tirada de espacios. **Regla para un regex de tapado:** que arranque por algo raro (la
  palabra, el principio del texto con `^` sin `m`, el borde exacto de la clave) y capture el contexto en vez de mirarlo
  hacia atrás. Medido: con la línea gigante peor, de 1489 ms a 120 ms (la base sin las reglas nuevas, 87 ms).
- **La segunda revisión (Integración, el mismo día) encontró que la cercanía no alcanzaba.** Pedir «mistral» a menos de 40
  caracteres en la misma línea dejaba pasar justo cómo se pega una clave en WhatsApp: «Clave de Mistral 👇» y la clave en la
  línea de abajo. Tampoco tapaba dos claves con un solo rótulo. Ahora, si el texto NOMBRA a Mistral en cualquier lugar, se
  tapa TODA clave de su forma (`MISTRAL_NOMBRADA`, sumada sólo a ese texto). Sigue siendo lineal: la línea gigante peor,
  con 30 mil claves y la palabra al final, entra en el tope.
- **Un `$1` que se traga el marcador de otra regla deja bytes NUL.** `redactarCon` (lib/agente-redaccion.ts) cambia cada
  secreto por un marcador `\u0000N\u0000` y al final los expande, pero el texto de un reemplazo no se vuelve a expandir. Con
  otra clave entre «mistral» y la de Mistral, el contexto capturado traía un marcador crudo. Postgres rechaza un NUL en
  `text` y en `jsonb`: el mensaje del grupo no se encolaba, `encolar` lo tomaba como una re-entrega, y MaKo lo perdía sin
  avisar (y lo mismo en el chat de la app). **Regla:** lo que vuelve en un grupo de captura se expande ANTES de guardar el
  reemplazo, y no se descuenta de lo tapado.
- **`insertUsage` no avisaba si la base rechazaba la fila.** supabase-js no tira: devuelve `{ error }`, y nadie lo miraba.
  Una fila de `anthropic_usage` rechazada se perdía en silencio, y el freno de 5 min de su-clave la daba por escrita.
  Ahora `insertUsage` devuelve si escribió, `recordUsage` lo pasa en `escrita`, y su-clave marca antes de escribir y
  desmarca si no quedó.
- **Sin hacer:** Fathom, Panda y Zernio no tienen regla, y su formato no se verificó. Una clave de Mistral pegada con otro
  texto y sin nombrar a Mistral («<clave>\ngracias!») sigue pasando: sin el nombre ni el texto solo, es la forma de un id.

## El crédito de la cuenta 1 como el Claude del ws1, con su interruptor en el Uso (22/10/2026)

**La decisión, textual** (Martín, por el Cerebro): «habilita los tokens de la API de la cuenta de Mauricio, esos 200, para su
Ops Center, que lo pueda usar, así puedo seguir probando en Automations», y «dame luego una opción para deshabilitarle esa
API a Mauricio en SuperAdmin, tal vez en USO, que pueda desactivar». Es una excepción a «Por ahora solo en onboarding».

**Vive en:** `CREDITO_DE_UN_NEGOCIO` (lib/veto-claude.ts: ws1 → `ANTHROPIC_CREDITO_CUENTA1`) · lib/credito-negocio.ts (el
interruptor y la clave) · la puerta 2 (`permisoDeLaClaveDelNegocio`, lib/anthropic.ts) · la sección «API» del Uso
(app/admin/operaciones/UsoCredito.tsx, en la computadora y en el teléfono) · tests/credito-negocio.test.ts.

- **Entra por la puerta 2, no por la 3.** La puerta 3 (`conCreditoDeLaPlataforma`) sólo contesta TEXTO y sólo en la red de
  la plataforma, y el Ops Center y la estrella de cada tab son el chat con herramientas. La puerta 2 sirve a las dos cosas
  (el chat con herramientas y la cascada de texto, que la prueba primero), y ya sabía tratar un crédito como el Claude de
  un negocio (el ws10): con Haiku, nunca el Plan, y el gasto con la marca del crédito. Sin su clave propia, o con una copia
  de la de MaKo, la puerta 2 usa la del crédito asignado. Si la conecta, gana la suya.
- **Trampa: no se pega en la fila del ws1.** Es el workspace del entorno (`hidratarCredenciales`), y su fila pasaría a ser
  la clave de MaKo (lo del 18/10). Tampoco se escribe la marca del crédito en el ws1: la puerta la escribía al reconocer un
  crédito por su valor, y el asignado no es su fila.
- **El interruptor vive en el workspace de la plataforma** (`ia.credito_negocio.1`): el negocio no lo ve ni lo toca. Sin
  fila, PRENDIDO (lo pidió Martín, y prenderlo no necesita escribir en producción). «No pude leerlo» es apagado para ese
  pedido.
- **Lo que deja de verse:** «Conecta tu IA» (la caja pregunta `claveDelCreditoAsignado`), y «Es la clave de MaKo, no la
  tuya» (la tarjeta muestra `credito` y saca las copias; en /integraciones, la de Claude sale conectada).
- **Error que ya estaba en el Uso:** las filas «(su clave es el crédito)» no traen el número de la cuenta, y `creditoQuePago`
  las mandaba todas a la cuenta 1: lo del ws10 (cuenta 2) se le sumaba a Mauricio. Ahora van a la cuenta del NEGOCIO.
- **Medido en producción (22/10, sólo lectura, nada escrito en el ws1: 564 ajustes antes y después):** el crédito asignado
  está prendido y su clave se lee; la puerta 2 da permiso para `mako-doer` y `chatbot-crear-ia` (Haiku, como crédito) y no
  para `plan-fathom`; la tarjeta dice `anthropic:credito`; la clave contesta 200 a `count_tokens` (que no cobra).
- **Probado rompiéndolo** (las 11 en rojo): la puerta sin el crédito, el crédito tapando su clave propia, la marca en el ws1,
  el interruptor que no apaga, «no pude leer» prendido, cualquier negocio prendible, la tarjeta, la caja, la cuenta de «su
  clave es el crédito», la pantalla y la acción sin la puerta del super admin.
- **SIN hacer — por qué esto NO alcanza para soltar IA16:** el crédito cubre lo que pasa por la puerta 2. Al ws1, con IA16, le
  seguirían faltando: el Plan (que nunca paga IA de MaKo: hace falta su clave, o que Martín amplíe la excepción); las notas
  de voz (Claude no transcribe: hace falta su Gemini o su OpenAI); «Hola MaKo» en WhatsApp (el doer escala a su Claude sólo
  con «su IA»); y el buscador de conocimiento (embebe con su Gemini). Con su Gemini gratis conectada, eso se resuelve.

## Las decisiones de Martín del 22/10/2026 sobre la IA de MaKo, y el Plan con la clave del negocio

**Las decisiones, textuales** (las tomó en el formulario del Cerebro el 22/10/2026):

1. **El instalador 0.3.2:** «Subilo ya». Ya está subido: el bucket quedó completo y la instalación de cero en el ws3 anduvo.
2. **La OpenAI de MaKo sin crédito:** «Tenemos Gemini que hace todo eso, gratis o más barato». No se le carga crédito. La
   transcripción de anuncios, la lectura de creativos y el buscador de conocimiento pasan a Gemini. Antes de re-embeber el
   conocimiento con el embedding de Gemini, hay que medir cuánto cuesta y cuánto tarda.
3. **El corte:** «No quiero que se corte Gemini, pero sí todas las otras».
   - **IA10 queda CANCELADO.** Gemini sigue como la base de quien no conectó su IA.
   - Se van Cerebras, Mistral y OpenRouter (IA8) y también Groq. El audio de quien no tiene OpenAI pasa a Gemini.
   - Antes de sacar Groq de las notas de voz de WhatsApp, hay que medir la demora.
   - **Esto lo dio vuelta Martín a las 17:20:** «Cada usuario debe poder pagar su token, su propia IA de gemini». Gemini
     ya no es la base de quien no conectó su IA: sin su IA no hay IA de la plataforma, y su Gemini es su IA (IA16, abajo).
4. **El Plan:** «Sí, si es su clave». Es una EXCEPCIÓN a «NO, JAMÁS algo pago para el plan» (30/09/2026). Está abajo.
5. **El Closing Analyst del ws1 después del 13/11:** «Con su clave de Claude». Sin clave, el Analyst le pide que la conecte.

**Lo medido el mismo día** (anthropic_usage, sólo lectura): el tope gratis de Gemini se agota TODOS los días.
- El 22/10 se agotaron las 4 cuentas entre las 05 y las 08 h de Tijuana, después de unas 190 respuestas.
- Desde el 15/10, cada 429 de Gemini es el tope POR DÍA (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`). Fueron 3069
  rebotes en 14 días.
- Offer se lleva el 57 % de las respuestas.
- Por eso el ws1 leyó «No tienes ninguna IA gratis conectada»: sus filas de IA son copias de la plataforma, que se
  descartan, y la red de la plataforma estaba topada. El mensaje (`falloDeIA`) no mira los errores de esa red.
- **Las notas de voz, antes de sacar Groq.** Medido el 22/10 a las 11 h de Tijuana, con las claves de la plataforma, el
  mismo pedido que `sttWhisper`/`sttGemini` y 3 corridas por caso. Las notas son sintéticas (la voz de Windows), en Opus
  16 kHz como las de WhatsApp:
  - 20 s: Groq 0,66 s; Gemini flash-lite 14 s; Gemini flash 503 «high demand» las 3 veces.
  - 1 min: Groq 0,8 s; flash-lite 22 s; flash 59 s, y 2 de 3 fallaron.
  - 2 min: Groq 1,2 s; flash-lite 19 s; flash 429 de tope.

  Las notas ya van primero a Gemini (`CASCADA_STT`), y hoy Groq es lo que las salva cuando Gemini falla. Sin Groq, una nota
  tarda 15-20 s o no se transcribe hasta que vuelva el tope. El Gemini PAGO no se midió (no hay clave). Se le pasó el
  número a Martín, y Groq no sale de las notas de voz hasta su respuesta.

**El Plan con la clave del negocio: lo que no se ve**

- **«Su clave» no es «su IA».** Por eso `planConSuClave` (lib/ia-del-negocio.ts) es una pregunta distinta de
  `negocioConSuIA`:
  - la PC no cuenta: el Plan corre de fondo, y la suscripción no se puede usar de fondo (D6a);
  - el crédito de Max de Martín (el ws10) no lo paga el negocio.
  Con su OpenAI o su Claude pagos, el Plan usa SÓLO esa IA (D6b). Con nada de eso, el Plan sigue como siempre.
- **El D6b del Plan se decide aparte, también adentro de otro pedido.** Por ejemplo, un `plan-fathom` adentro de una
  herramienta del doer. Antes de este cambio, el Plan se decidía siempre «afuera».
- **La puerta volvía a entrar sin fin.** Con el Plan decidido «adentro», `pasaPorLaPuerta` volvía a dar cierto, y la puerta
  entraba otra vez. Ahora el contexto lleva la marca `delPlan`. **Regla:** una puerta que decide distinto según la función
  necesita la marca «ya decidido PARA ESTA función», no sólo «ya decidido».
- **En la puerta 2 (lib/veto-claude.ts), el Plan va SIEMPRE con Haiku**, aunque el negocio haya elegido Sonnet: es lo que
  más se usa (el Perro, las reuniones). Lo decidió este chat; si Martín quiere otra cosa, es una línea.
- **Nunca con el crédito de Martín, y sin poder compararlo con el crédito, tampoco.** La plataforma sigue sin pagar el Plan
  por ninguna puerta.
- **Sin hacer:** el Plan de un negocio que tiene sólo su PC no tiene IA (la PC no corre de fondo, y desde IA16 la red de
  la plataforma no corre para ningún negocio): necesita su clave de Claude, de OpenAI o de Gemini.

### Lo que encontró la revisión adversarial de IA15 (22/10/2026), y cómo quedó

- **ALTA — `credWsEstricta` era estricta sólo frente a la base caída.** Una fila que EXISTE y no se descifra (el secreto rotó,
  la fila se dañó, una migración de cifrado a medias) devolvía `null`. Con eso, la frontera de la puerta 2 no reconocía ni
  el crédito de Martín ni la copia de la clave de MaKo, y el Plan del ws10 pagaba con el crédito y el de un negocio con la
  copia pagaba con la de MaKo. Lo reprodujo con filas cifradas para otro ws. Peor aún: con la marca «del negocio», ese
  gasto salía del de MaKo. Se arregló en dos capas:
  - `credWsEstricta(…, { ilegibleTira: true })` en la frontera de la IA (la opción no se usa en los webhooks: ahí tirar es
    otra decisión);
  - la puerta 2 de una función del Plan pide la decisión del Plan, en «sí» y cierta (`planPuedePagarConSuClave`).
  **Regla:** una lectura «estricta» tiene que tirar con TODO lo que no pudo leer, también con una fila que no descifra; y
  una decisión de plata no se toma con la lectura de una sola capa.
- **MEDIA — con su OpenAI, el Plan pedía 32.000 tokens de salida a gpt-4o-mini** (acepta 16.384) y fallaba siempre en las
  llamadas grandes, anotado como fallo de SU clave. Ahora `conTechoDeSalida` (lib/ai-cheap-techo.ts) topa por modelo en
  los tres pedidos de la capa barata.
- **BAJA, latente — lo que no es del Plan heredaba la decisión del Plan** cuando se llamaba desde adentro de una función
  del Plan. Ahora el contexto guarda la decisión de afuera (`deAfuera`), y lo que no es del Plan y trae su `feature`
  vuelve a la puerta.
- **Los tests no miraban `planConSuClave` caso por caso.** Faltaban la PC sola, la base caída, una clave ilegible y una
  copia. Ahora están en tests/ia15-frontera.test.ts, con 10 roturas en rojo. Tres de esas roturas quedaron en verde la
  primera vez: la del valor incierto que se recuerda no se veía porque «sí» y «no» coincidían. Se cubrieron con el ws16,
  una copia, donde la decisión real y la incierta difieren. **Regla del test:** para ver que un «no pude saber» no se
  recuerda, el caso tiene que ser uno donde la respuesta incierta y la real sean distintas.
- **Sin hacer (MEDIA, para Martín):** el crédito se reconoce por su VALOR contra las claves cargadas hoy. Si se borra la
  fila del crédito en la plataforma, o se rota dejando viva la vieja que tiene el ws10, el Plan del ws10 vuelve a pagar con
  él. Hace falta una marca que no se borre, por ejemplo las huellas de las claves del crédito guardadas aparte, o una marca
  «la paga la plataforma» en la fila del ws10.

### La revisión del lote 2 (Integración, 22/10/2026), y cómo quedó

- **El crédito de Martín ya no se reconoce sólo por su valor.** La decisión fue del Cerebro, textual: «que no dependa del
  valor. Marcá la credencial del ws10 con una marca explícita… que se lee aunque la fila de la plataforma no exista».
  - **El problema:** borrada o rotada la fila `ANTHROPIC_CREDITO_CUENTA2` del ws9, el ws10 volvía a elegir Sonnet sobre el
    crédito, a pagar su Plan con él, y ese gasto se anotaba «del negocio», fuera del costo de MaKo y sin verse.
  - **La marca** (lib/credito-marca.ts) vive en los ajustes del negocio (`ia.su_claude.credito_de`): la HUELLA de su clave
    y de qué cuenta es.
  - **Quién la lee:** la puerta 2, `planConSuClave` y la tarjeta. Cuando la puerta 2 reconoce el crédito por su valor y
    falta la marca, la escribe.
  - **El gasto** de esa clave se anota como del crédito de la plataforma (`marcaDelGasto`), así que se ve aparte.
  - **El 22/10 se escribió la del ws10** (…CUENTA2), el único negocio con una clave del crédito. El test
    (tests/credito-marca.test.ts) borra la fila de la plataforma y exige que el ws10 haga exactamente lo mismo.
  - **Regla:** algo que decide plata no se reconoce sólo comparando contra una fila que alguien puede borrar.
- **«Importar al plan» pagaba fuera del Plan.**
  - **La causa:** `importar-en-segundo-plano` leía las fotos y los PDF escaneados con la feature por default de
    `archivoATexto` («Importar al plan»). Esa feature no es del Plan, porque también la usan el CRM, el chat y el Video
    Generator.
  - **El arreglo:** el Plan pasa `plan-importar`, que va en `FEATURES_DEL_PLAN`. El barrido del test ahora falla con un
    `archivoATexto(` sin feature en un archivo del Plan.
- **Mistral nombrada tapaba parámetros de links** (el `pwd=` de un Zoom junto a «Av. Gabriela Mistral»). Ahora un id pegado a
  un link no cuenta: después de `=`, `/`, `?`, `&`, `#`, o seguido de `.`.
- **Y el arreglo de los links abrió una regresión** (tercera revisión, el mismo día).
  - **Qué pasó:** para no tapar el `pwd=<id>.1` de un Zoom, el token pedía que no lo siguiera un punto. Entonces «Mi clave
    de Mistral es <clave>.», con la clave al final de una oración, pasó entera al modelo y a `chart_chats`.
  - **El arreglo:** ahora sólo un punto SEGUIDO de algo más es parte de un link. El link ya lo protegen el `=` y la `/` del
    lookbehind.
  - **Lo que tampoco agarraba nadie:** `mistral_key=…` en minúscula, porque la regla de .env es sólo de MAYÚSCULAS. Ahora
    hay una regla para el nombre asignado.
  - **Regla:** al angostar una regla de tapado para no tapar de más, se vuelve a probar el caso más común (la clave al
    final de una frase), no sólo el que se quería dejar pasar.
- **Una fila de IA ilegible en el ws9 apagaría la IA propia de todos los negocios** (por `ilegibleTira`). Se miró antes de
  subir: 22 de 22 filas legibles. El mensaje ya no dice «la base no contestó», que en ese caso era falso.
## Cada negocio paga su IA —también su Gemini—, y Groq sólo escucha (IA16, 22/10/2026)

**Las decisiones, textuales:**
- «¿Dejamos Groq sólo para transcribir las notas de voz?» → «Groq sólo para las notas de voz» (Ops Center, 16:24).
- Del pago de Gemini primero dijo «Sí, sin tope» (16:24), y **después lo dio vuelta** (17:20): «Cada usuario debe poder
  pagar su token, su propia IA de gemini». **Quién paga la IA de un cliente: el cliente.** La plataforma no paga ni presta
  IA a ningún negocio; lo único que pone es el crédito de Claude del onboarding, que no cambia.

**Cómo quedó (las reglas del Cerebro, del mismo día):**
1. «Conectar tu IA» suma **Gemini por clave de AI Studio**, al lado de Claude y GPT, con el link y una línea de cómo.
2. Un negocio con su Gemini lo usa para TODO (D6b, sólo la suya): texto, documentos, audio y el buscador de conocimiento.
3. Sin su IA, **no hay red de la plataforma**, con o sin datos de clientes: «Conecta tu Claude, tu GPT o tu Gemini».
4. Las claves de Gemini de la plataforma quedan para lo interno de MaKo (el ws9). Las 3 de más se quedan.
5. Se fue la marca `ia.gemini.plataforma_paga` (lib/gemini-pago.ts y su script).

**Vive en:**
- `lib/ai-cheap.ts`: `provsGratisDePlataforma` devuelve `[]` fuera del ws9; `clavesDeSuGemini`; `PROVS_SOLO_AUDIO`, `deTexto` y `sinGroq`.
- `lib/solo-su-ia.ts` (`PROVS_SU_IA = ['gemini', 'openai']`) y `lib/ia-del-negocio.ts` (`CLAVES_SU_IA` con Gemini).
- `lib/embeddings.ts`, `scripts/reembeber-conocimiento.mts` (por workspace).
- `lib/conectar-ia-reglas.ts` y `app/integraciones/TusCuentasIA.tsx`.
- `lib/reembeber-al-conectar.ts` (al guardar su Gemini; desde el 25/10, su OpenAI o su Gemini) y `reembeberLoQueFalta`
  (lib/mako-knowledge.ts).
- «Tus cuentas de IA» con su Gemini: `lib/su-clave-reglas.ts`, `lib/su-clave.ts`.
- `tests/ia16-cada-uno-su-ia.test.ts` (con `tests/_ia16-hijo.ts`).

**Lo que no se ve:**
- **Google no dice el plan de una clave sin gastarla.** Medido el 22/10: la lista de modelos, el GET del modelo y
  `countTokens` contestan los mismos headers y el mismo cuerpo en el plan gratis y en el pago. Por eso el aviso del plan
  gratis («Con la gratis, Google puede usar tus datos…») va SIEMPRE, no sólo a quien está en el gratis.
- **Las claves de Gemini de hoy NO empiezan con `AIza`.** Nacen «auth»: `AQ.` + 50 de base64url, 53 en total (medido sin
  leerlas: largo, prefijo y alfabeto). La regla que tapa claves en el chat (`google`, lib/agente-redaccion.ts) conocía sólo
  `AIza`: **una clave de Gemini de verdad pegada en el chat pasaba entera al modelo.** Y la pantalla de la clave decía
  «Empieza con AIza». Las dos se arreglaron con este cambio, que es justo el que le pide a cada negocio la suya.
  **Regla:** el formato de una clave se mide contra una real, no contra la documentación vieja.
- **El vector sale del modelo, no de la cuenta.** La consulta de un negocio, embebida con SU Gemini, encuentra el método de
  la plataforma (embebido con la del ws9): el mismo `gemini-embedding-001` a 768. Lo que no se compara es otro modelo
  (los 1536 de OpenAI): `searchKnowledge` compara sólo los del mismo largo.
- **Sin su Gemini no hay buscador.** Su Claude o su GPT no sirven: los vectores de OpenAI son de otro espacio, y la
  consulta lleva la charla con sus clientes, que no puede ir a la cuenta de MaKo. `embed` tira «Conecta tu Gemini…»
  (`SIN_SU_GEMINI`), que queda en `falloDelRag` y en el `error` de la fila.
- **Lo que daba por hecho que «su IA» era sólo su OpenAI.** Además de la cascada, dos listas fijas `['openai']`: la de
  `chatClaudeTools` (lib/anthropic.ts) y los candidatos del doer de WhatsApp (lib/mako-doer-in.ts). Con sólo su Gemini,
  ninguna de las dos lo probaba. Ahora las dos son `PROVS_SU_IA`.
- **«Groq sólo escucha» es UN corte con tres capas, y el test mira cada una:** `proveedor` no da Groq para texto aunque
  lo pida un pin; las cascadas lo sacan aunque una lista lo nombre (`deTexto`); la red lo trae sólo para audio. La
  primera tapaba a las otras dos, y dos roturas quedaron en verde. Se separaron mirando los errores de la cascada.
- **Cinco tests de D6b tenían de CONTROL «un negocio con sólo Gemini, sin su IA».** Con su Gemini como su IA, el control
  quedó adentro de D6b y los tests decían «fuga». No se aflojaron: se cambió el negocio de cada uno.
  **Había un SEXTO, y se vio recién al mergear main (23/10):** `tests/d6b-confirmar.test.ts` (confirmar una tarjeta) contaba
  todo pedido a `generativelanguage` como fuga, y su negocio tiene su OpenAI y su Gemini: dos rojos. Ahí el host no alcanza
  para decidir, así que el hijo anota DE QUIÉN es la clave (`#negocio` / `#plataforma`) y la fuga es la clave de la
  plataforma. Y su rotura cambió: sacar la puerta de D6b ya no fuga sola (la plataforma tampoco le presta afuera); lo que lo
  pone rojo es abrirle la red a un negocio (1 fallo, 3 pases). Lo que no es su IA ahora
  es Groq (escucha con la suya, y es el control de la nota de voz); y «sin su IA» ya no sale a ningún lado. Los vio correr los
  tests que LEEN los módulos tocados, no sólo los míos: 13 rojos en 5 archivos (solo-su-ia, d6b-puerta, d6b-rutas, ia-pc,
  ai-step-conecta-claude). **Regla:** cuando cambia qué cuenta como «su IA», se buscan los tests cuyo control lo daba por hecho.
- **La clave del entorno nunca es la del negocio.** El `.env.local` de esta PC trae la …YTBA (una de la plataforma). Los
  embeddings leen las filas del negocio (`provsDe` → `credDelCliente`), así que un script local no la usa.

**Medido el 22/10 (sólo lectura), quién queda SIN IA cuando suba:**

| Negocio | Su IA | IA en 7 días (por la red) |
|---|---|---|
| ws1 Mauricio | ninguna (copias de Claude, Gemini y OpenAI) | 327 (70) |
| ws3 Cliente de Prueba | ninguna (5 PC) | 536 (455) |
| ws21 Florencia | ninguna | 28 (8) |
| ws22 Patricia | ninguna | 8 (3) |
| ws4 Cliente de Diseño | ninguna (copias) | 3 (0) |

Con su Gemini siguen: ws13, ws15, ws17, ws18, ws19, ws20; ws14 (Gemini y OpenAI); ws11 (Claude, GPT y Gemini); ws10
(Claude; su Gemini es una copia).

**Lo que encontró la revisión adversarial (22/10), y cómo quedó.** No encontró fugas nuevas. Sí esto:
- **ALTA — El Archivero y el dictado del Plan daban «no» con sólo su Gemini.** Los dos preguntaban por su OpenAI
  (`puedeArchivarConSuIA` en lib/mako-turno-app.ts, y app/api/plan-dictado/route.ts). Ahora preguntan por `PROVS_SU_IA`.
- **ALTA — El método de MaKo desaparecía del buscador de TODOS.** Vive en el ws1 (las filas `fuente: 'mako'`), y el ws1
  sólo tiene copias de la plataforma: «cada uno con la suya» no lo dejaba embeber. Es contenido de MaKo, no del negocio:
  se embebe con la de la plataforma (`embed(…, { deMako })`, sólo para la `fuente` que se presta). El test del buscador lo
  escondía: ponía el método en el ws9, no donde vive.
- **Gemini primero cambiaba a quien ya tenía su GPT.** Muchos negocios cargaron una Gemini gratis en el onboarding, cuando
  MaKo se la pedía (el ws11 tiene las tres). Con D6b sus datos iban sólo a su GPT. **Ahora su GPT va primero y su Gemini es
  el respaldo** (`PROVS_SU_IA = ['openai', 'gemini']`). Y `ordenarPorCuota` respeta ESE orden: la lista del audio es Gemini
  primero, y sólo filtrar la dejaba así. Con sólo su Claude y su Gemini, en `chatClaudeTools` y en el doer su Gemini va
  antes que su Claude (hoy no hay ningún negocio así: el del ws10 es una copia).
- **Nada re-embebía al conectar su Gemini.** Ahora /integraciones lo hace en segundo plano al guardarla.
- **Detalles:** su Gemini en «Tus cuentas de IA» (tarjeta, «Probar mi clave» con la lista de modelos, y sus fallos
  anotados); la tarjeta de Groq decía «la de MaKo» con D6b (`provsDe` corre fuera de D6b para esa pregunta); el ejemplo de
  la clave 2 decía `AIza…`; un `groq` de más en `ENV_DE_IA` (de IA16 v1) era un error de tipos.

**Probado rompiéndolo** (22/10, una rotura por vez, restaurada; las 14 en rojo): la red para cualquier negocio, el
embedding con la clave del entorno, sin probar la otra cuenta, `PROVS_SU_IA` sin Gemini, `CLAVES_SU_IA` sin Gemini, el
buscador sin el filtro de largo, el anuncio a Groq, una copia de la plataforma contada como propia; y después de la
revisión: su Gemini antes que su GPT, `ordenarPorCuota` con el orden de la lista, el método sin `deMako`, `deMako` para todo,
re-embeber lo que ya estaba, El Archivero sólo con su OpenAI. La regla de Google sin `AQ.` pone en rojo sus dos tests.

**Y «Costo de MaKo» le dibujaba IA gratis que no tenía** (lo vio Integraciones en producción el 23/10, en el ws10): Gemini,
Groq, Mistral y OpenRouter como «gratis» a un negocio sin ninguna, como si la plataforma se las prestara. Eran dos cosas:
la lista de cuotas (`LIMITES_PROVEEDOR`, lib/ia-cuotas-calculo.ts) seguía con los dos que IA8 sacó, y `cuotasProveedores`
arma una caja por proveedor aunque el negocio no tenga una clave cargada («una fila vacía en el slot 1»). Ahora la lista es
Gemini y Groq, y la página pide `soloCargadas`: las que el negocio tiene o usó hoy. La API de MaKo (`ver_cuotas_ia`) sigue
pidiendo todas, porque su contrato dice también las que tienen 0 cuentas. ⚠️ **El test de IA8 daba verde**: miraba que
/integraciones no OFRECIERA conectarlos (el catálogo), y la caja salía de OTRA lista. Un proveedor que se saca vive en todas
las listas que lo nombran, no sólo en la que se ve primero (test 8 de tests/ia16-cada-uno-su-ia.test.ts, cuatro roturas,
las cuatro caen).

**Y el cartel de WhatsApp le daba a un negocio sin su IA un porqué falso** (lo levantó el vigía: ws21 Florencia, 22/10
09:36 UTC, «Estas analizando mis fathom?», 0 claves, `cartel:sin_red_por_datos`; medido el 24/10, sólo lectura):
- **El diagnóstico obvio —«el cartel la dejó sin salida»— era falso.** Le llegó (el anillo de enviados del grupo se
  escribió 11 s después) con el link a /integraciones (`?abrir=gemini&ws=21`, el de antes de IA9). Y ese día el porqué era
  cierto: la red existía (IA16 v2 se commiteó esa noche y entró a main el 24/10 00:29 ART). Florencia nunca conectó nada (0
  filas en `credenciales` hoy, ninguna llamada con una clave suya) y no volvió a escribir.
- ⚠️ **«IA16 está en main» no es «la red ya no corre».** El último deploy medido (la «prueba» de los avisos de arreglo:
  137b91f76, 23/10 23:09 ART) no la trae: hasta que se despliegue, la red sigue contestando a los negocios sin su IA, y
  este arreglo tiene que ir en el mismo deploy (sin él, el ws21 pasa a leer el porqué falso).
- **Lo que se volvió falso con IA16: la marca «red gratis salteada» se dejaba sin preguntar si había red.** El doer la
  ponía con sólo mirar el turno (`turnoParaLaRed`); con la red en `[]`, todo negocio sin su IA que preguntaba por sus
  reuniones o sus leads leía «no los mando a la IA gratis de MaKo» (como si sin datos le hubiera contestado), el log decía
  «red de plataforma salteada» y el vigía anotaba `sin_red_por_datos`; el mismo negocio, sin datos, recibía `sin_keys`. Ahora
  el doer pide la red ANTES de decidir qué saltear y sin red no marca; el cartel lo elige `cartelDelFallo` (lib/fallo-ia-texto.ts).
- **`sin_keys` seguía vendiendo «Las de Google y Groq son *gratis*»** con el link al modal de Claude. Ahora pide
  `CONECTA_TU_IA`; el de una nota de voz, su Gemini o su GPT (su Claude no escucha), con el link a Gemini. ⚠️ Ese aviso
  sale directo (`enviarAGrupoJid`), sin el `linksConWs` que le pone el `?ws=` a la respuesta de texto: salía sin su
  negocio. Ahora `linkApp(rutaKeysIA('audio'), wsData)`.
- **`clavesCargadas` devuelve `[]` para los de UNA clave (anthropic, openai), aunque se los pidan.** `contarKeysIA`
  contaba sólo su Gemini: un negocio con sólo su Claude —lo que el cartel le pide— contaba cero, y si su Claude fallaba
  leía «todavía no tienes tu IA». Hoy ningún negocio tiene sólo Claude o sólo GPT: estaba latente. Contar filas de IA va
  por `contarClavesCargadas` / `cuantasClavesDeIA` (lib/ia-keys.ts, lib/ia-keys-ws.ts).
- **El crédito de Claude no era la respuesta:** Florencia lo tuvo (su onboarding del 18/10: 16 turnos y 2 documentos, 19 filas con la marca); es sólo para
  el onboarding en curso (`CREDITO_HABILITADO_PARA`) y el doer de WhatsApp no está.
- **El texto de un cartel no queda en ningún lado** (`avisoDeSistema` va fuera del historial y la fila del vigía trae la
  causa): para saber qué leyó hubo que reconstruirlo del código de main a esa hora.
- Lo fija tests/doer-cartel-sin-ia.test.ts (doce roturas, las doce caen).

**SIN hacer:**
- **El onboarding no pide su IA.** El paso «Tu IA» (`gemini`) salió del arranque y ninguna capa lo pide
  (lib/onboarding-hechos.ts → `SALIO_DEL_ARRANQUE`, lib/capas.ts); no hay aviso en la app antes del primer cartel. El ws21
  y el ws22 terminaron sin ninguna, y desde IA16 MaKo no les contesta nada. Es del chat Onboarding: sumar «Tu IA» a la
  capa, o un recordatorio en /general (lib/onboarding-pendientes.ts).
- **Subir.** Apaga la IA de los negocios de la tabla hasta que conecten la suya. **Retenida** (el Cerebro, 22/10): no entra
  a main hasta que el ws1 conecte su IA o hasta el lunes 26/10, lo que llegue primero (el sábado 24 arranca la campaña de
  Mauricio y no puede quedarse sin el chat de MaKo). El paso de Mauricio (ws1): «conectá tu
  Claude, tu GPT o tu Gemini»; con Gemini empieza gratis. **Actualizado el 24/10:** entró a main el 24/10 00:29 ART
  (2c456a7bf, «integra ia16-2210 en el tren»); desplegada, sin medir (el último deploy medido, 137b91f76, no la trae).
- **Re-embeber el conocimiento** (`scripts/reembeber-conocimiento.mts --aplicar`): toca los negocios con su Gemini, el
  ws9 y el método de MaKo del ws1. Las filas de los demás se embeben solas cuando conecten el suyo.
- **Automations:** `SU_IA` y `SU_CLAVE` (lib/flujo-ia.ts) los cambió IA16, de acuerdo con ese chat. Cuando IA16 esté en main,
  Automations saca de `sinIAPropia` los textos de «la IA gratis de MaKo» (fuera del ws9 ya no se ven).
- **El selector «+» de la caja no ofrece su Gemini** (medido al mergear main, 23/10): `cuentasDeIA` (lib/chat-ia.ts, el
  «Con qué IA corre un chat» del 23/10) arma PC, «Tu Claude» y «Tu ChatGPT», y nada más. **Un negocio que sólo tiene Gemini ve
  sólo Automático, aunque D6b lo mande a su Gemini.** No se rompe nada (Automático sale por su Gemini), pero contradice
  «Conectar tu IA», que sí la ofrece. Lo reparte el Cerebro al chat del selector (8b): una cuenta `gemini` en `cuentasDeIA`,
  en `CuentaDeIA` (lib/chat-ia-reglas.ts) y en el turno que honra la elección (lib/mako-turno-app.ts).
- **Su Groq, con su IA:** D6b no deja a un negocio con su IA usar su propio Groq para las notas de voz (es así desde el
  21/10). El ws10 y el ws11 (los dos con su Claude) tienen una fila de Groq que por eso no escucha (medido el 22/10;
  no se miró si es una copia de la plataforma). Si se quiere, es una línea (`proveedorPermitido` y `ordenarPorCuota`).
- **A vigilar:** los Pedidos de los chats eran Groq primero porque es más rápido (1,4 s medido, contra 6-11 s de Gemini).
  Con su Gemini, más pedidos van a llegar tarde y van a seguir por las reglas.
- **Fuera de IA16, de la revisión** (ya estaban antes, chocan con «sin su IA no hay IA de la plataforma»):
  - el montaje de video escucha los anuncios de cada negocio con el Groq de la plataforma (`envCred`, app/api/cron/montaje
    y lib/montaje/pipeline.ts), y le pasa a los scripts hijos todo `process.env`;
  - el Closing Analyst del ws1 usa el Claude de la plataforma hasta el 13/11 (la lista blanca `closing`, lib/veto-claude.ts):
    es la decisión del 13/8, ¿es la segunda excepción?;
  - la visión del onboarding (la foto de la cara de marca, un PDF escaneado) no tiene el crédito de Claude: sin su IA, falla.
- **Los ganchos de tapado ya instalados en las PC** siguen con la regla vieja de Google (sin `AQ.`) hasta que se bajen de
  nuevo.
- **Sólo cuenta `GEMINI_API_KEY`:** un negocio con sólo `GEMINI_API_KEY_2` no es «con su IA» (no hay fuga: la red está
  apagada).


## «Tu ChatGPT» en el Ops Center: cableado, nunca usado, y siempre el modelo más chico (23/10/2026)

**El pedido:** Martín, desde el Ops Center: *«¿Ya implementaste GPT? Para usarlo en el Ops Center de
todos. Eso ya debería estar...»*. La respuesta corta es «por clave sí, por la computadora no», y la
larga tiene tres trampas que no se ven mirando el código de una sola capa.

**Por clave, anda — medido, no supuesto.** Elegir «Tu ChatGPT» en el «+» del chat manda el turno
con `soloSuOpenAI: true` (`lib/mako-turno-app.ts`, el `ia?.cuenta === 'openai'`): directo a la
OpenAI del negocio y sin caer a Claude. Cinco negocios tienen su clave cargada (ws1, ws4, ws9,
ws11, ws14), y la de Leila (ws11) contestó hoy mismo.

**Trampa 1 — no se elegía modelo, y corría el más chico.** `cuentasDeIA` (`lib/chat-ia.ts`) ofrecía
la cuenta con `modelos: []`, así que el turno corría con el `chatModel` de OpenAI en `cfgDe` de
`lib/ai-cheap.ts`: **`gpt-4o-mini`**, para el chat que orquesta herramientas. Desde la tarde del
23/10 el admin elige y hay un default capaz (abajo), **pero SÓLO con «Tu ChatGPT» elegido en el
«+»**. En Automático (lo que ve todo el mundo, y a lo que vuelve cada recarga porque la elección no
se guarda) y en el doer de WhatsApp sigue `gpt-4o-mini`.

**Trampa 2 — que haya clave no prueba que alguien lo use.** En 14 días hay **cero turnos del Ops
Center con GPT**. Todo el uso de OpenAI de ws11 es de otras features (`plan-fathom`,
`mako-guardian`, `setting-simulador`, `chat-agent-handoff`). «Ya debería estar» y «alguien lo
probó» son dos cosas: el camino del Ops Center con GPT nunca se ejercitó con un cliente real.

**Trampa 3, la que parece un bug y no lo es:** `CHEAP_MODEL` lo leen Groq **y** OpenAI en
`cfgDe`, así que si alguien lo setea para Groq, OpenAI recibiría un nombre de modelo de Groq.
Hoy no está seteado ni en `.env.local` ni en Vercel (38 variables, medido), así que no pasa.
Queda escrito para que el día que alguien lo setee sepa que pisa a los dos.

**Por la computadora (ola 3), apagado y con un portón que no es de código.** `CHATGPT_EN_LA_PC`
sigue en `false` (`lib/conectar-ia-reglas.ts`). El §9 de `docs/ia-del-cliente.md` pone la
medición IA11 como portón —¿`codex exec` carga el MCP de MaKo?—. Codex 0.164.0 quedó instalado
en la PC de Martín el 23/10 a las 20:38 (por npm, con su OK en el chat del Cerebro); falta su
`codex login`. El resto, en «La ola 3 por dentro», abajo.

«Sign in with ChatGPT» para apps de terceros (SIWC) sigue en prueba limitada con socios, sólo
Plus y Pro: el camino es el login del propio Codex CLI en la PC del cliente, no un botón de MaKo.

### La ola 3 por dentro: lo que encontró la investigación (23/10/2026, noche)

Martín, mirando «Tus cuentas de IA» → ChatGPT: *«Y el tema de GPT sigue diciendo "Pronto" en mi
computadora...»*. Una investigación de cinco agentes (el programa de la PC, el servidor, Codex CLI, el
diseño y un crítico) encontró que el diagnóstico obvio —«falta el corredor de Codex»— es un tercio:

- **La medición IA11 iba a dar ✗ por la razón equivocada.** En `codex exec` la aprobación es «never» y,
  con `--sandbox read-only`, una herramienta MCP sin `readOnlyHint` (las de MaKo no lo llevan) se
  rechaza ANTES de llamarla: «MCP tool call requires approval, but approval policy is never». Se habría
  concluido «GPT sólo por clave» con el MCP cargado perfecto. Arreglado en
  scripts/ia-pc/medir-codex-mcp.mjs: `default_tools_approval_mode="approve"` para el servidor de MaKo
  (sale del código de Codex, no de una corrida), el prompt por stdin, y dos preguntas nuevas.
- **«Sin manos» no existe en Codex como en Claude** (`--tools ""`). Con `--sandbox read-only` Codex
  puede LEER el disco, y el turno lleva mensajes de leads: una inyección podría hacerle leer archivos
  del cliente. `codex features list` (0.164.0) da prendidas `shell_tool`, `unified_exec`,
  `browser_use`, `computer_use`, `apps`, `plugins`, `view_image`: la receta candidata es apagarlas con
  `--disable`, y la medición lo prueba (3a como viene, 3b sin manos).
- **El login de Codex es más fácil que el de Claude**: `codex login` levanta su propio callback en
  127.0.0.1:1455 (o 1457), abre el navegador y termina solo, sin código que pegar. No hace falta la
  página local de Claude. Sin probar corrido sin consola.
- **Codex no tiene `--system-prompt-file`**: `-c developer_instructions` deja el system de MaKo en la
  línea de comandos (rompe «nada de la persona en la línea de comandos» y Windows corta en 32.767
  caracteres). La medición prueba que lo respete; el camino real está por decidir.
- **Lo legal es más duro que «OpenAI recomienda una API key»**: los Terms of Use de OpenAI (EE. UU.,
  1/1/2026) prohíben «make your account available to anyone else» y la extracción programática del
  Output; la doc de Codex acepta la sesión de ChatGPT en automatización sólo para runners privados de
  confianza. No hay autorización escrita. Es decisión de Martín, como lo fue el «No por ahora» de
  Anthropic para los leads.
- **El programa y el servidor dan por hecho que la PC es Claude**: `paraElLatido` manda
  `proveedor: 'claude'` fijo, `pcUsable`/`elegirPc` no miran el proveedor, los modelos son los de
  Claude, `claude_falta` es sólo de Claude, y el consentimiento dice «Tu Claude…». Los DATOS ya admiten
  ChatGPT (`CuentaPc.proveedor`, la tarjeta).
- **Cómo le llega al programa la IA que eligió la persona**: no por `mako://iniciar-sesion?ia=…` (la
  0.4.2 lee sólo el hostname y abriría el login de Claude, y en la Mac un `mako://` no llega): por el
  código de emparejar (una columna en `ia_pc_codigos`).
- **Nada actualiza el programa**: el servidor guarda la `version` del latido y no la compara. Una PC con
  la 0.4.2 a la que se le ofrezca ChatGPT nunca recibe la 0.5.0: hace falta una versión mínima.
- **El orden de subida importa**: la base del servidor por proveedor tiene que llegar a producción ANTES
  que un programa que reporte cuentas `chatgpt`. Si no, una PC con sólo ChatGPT recibe turnos de Claude.
- **`CHATGPT_EN_LA_PC` es global**: prenderla abre ChatGPT por la computadora a todos los negocios a la
  vez. Hace falta una prueba acotada antes (el ws de prueba o sólo el super admin).
- **IA16 casi no toca la puerta de la PC**: no toca lib/ia-pc*.ts, app/api/ia-pc/*, lib/chat-ia*.ts,
  CuentasYDispositivos.tsx, scripts/ia-pc ni installer. Choca sólo en la línea de «Pronto» de
  lib/conectar-ia-reglas.ts (la 48, entre las que cambia IA16) y en `AVISO_CONECTA_TU_PC`
  (lib/mako-turno-app-reglas.ts:613). Lo que frena prender la opción no es IA16: es el corredor.
- **La descarga para el Ops Center**: `GET /api/ia-pc/descargar?os=windows|mac` y el componente
  `NuevoDispositivo` (CuentasYDispositivos.tsx). La detección del sistema es una regex sobre `navigator`
  copiada en dos archivos, y da «windows» en Android y en iPhone.

**SIN hacer**, con su dueño:

1. Martín: `codex login` («Sign in with ChatGPT»). Después, `node scripts/ia-pc/medir-codex-mcp.mjs`
   (tres turnos de su cuenta). Sin el ✓ de 1 y el ✓ de 3b no hay corredor.
   ⚠️ **FRENADO el 24/10/2026, y no por falta de tiempo: Martín no tiene cuenta de ChatGPT** («por ahora no
   tengo cuenta de GPT»). O sea que el ✓ de 1 no se puede dar, y **todo lo que cuelga de él queda frenado**: la
   medición IA11, el «falta Codex» del punto 3 y el Codex del instalador del punto 4. No es un pendiente de
   Martín: es una rama cerrada hasta que haya cuenta. **No volver a ponérselo como tarea.** Lo que SÍ sigue vivo
   es el corredor con Claude Code, que no depende de esto.
2. Decisión de Martín: lo legal de OpenAI (arriba).
3. Este chat: lo que falta del servidor («falta Codex» por dispositivo, la versión mínima). Ya están la
   elección de la PC por IA, el consentimiento de ChatGPT, y la IA elegida, que viaja en su versión sin
   columna nueva (abajo).
4. El chat del Instalador (cuenta 3): el programa 0.5.0 (instalar Codex sin terminal —el paquete de
   OpenAI de ~159 MB o su install.ps1, nunca npm: el cliente no tiene Node—, `codex login` oculto, el
   turno con `codex exec --json`, el latido con `proveedor: 'chatgpt'`, el % usado por
   `codex app-server` por stdio), y el Inno y MaKo.app sin instalar Claude Code a quien eligió ChatGPT.
5. Sin medir: el sandbox de Codex en un Windows sin administrador (¿pide UAC?), el login corrido sin
   consola, la firma de codex.exe, y cuánto rinde cada plan de ChatGPT en turnos.

**Vive en:** scripts/ia-pc/medir-codex-mcp.mjs · scripts/ia-pc/mako-pc.mjs · lib/ia-pc-reglas.ts ·
lib/ia-pc.ts · app/api/ia-pc/* · lib/conectar-ia-reglas.ts · app/integraciones/TusCuentasIA.tsx ·
installer/windows/mako.iss · *2026-10-23, chat «IA del cliente»*

### La PC se elige POR IA (la ola 3, parte a: el servidor, 23/10/2026)

Lo que hace seguro subir el servidor antes que el programa: un turno de ChatGPT sólo va a una PC que
REPORTA una cuenta `chatgpt` (`pcUsable(pc, 'chatgpt')`), y ningún programa hasta la 0.4.2 la reporta.
Con eso, una 0.4.2 nunca recibe un turno de ChatGPT, que correría con Claude. Y a un turno de Claude
la ruta lo manda sin el campo `proveedor`: la 0.4.2 lo recibe idéntico.

- **`pcDe` devuelve una PC aunque no sirva**, la última que latió, para que el aviso diga qué le pasa.
  Con sólo su ChatGPT conectado, Automático buscaba la de Claude, encontraba ésa y avisaba «Tu Claude
  no tiene la sesión iniciada». Ahora, en Automático, la PC que no puede con su Claude y sí con su
  ChatGPT contesta con su ChatGPT. Un negocio sin ninguna PC no hace esa segunda lectura.
- **`pcUsable` tiene un segundo parámetro**: `.filter(pcUsable)` le pasa el ÍNDICE como proveedor, y
  ninguna PC sirve. Siempre `(p) => pcUsable(p, proveedor)`.
- **«Agotada» es por IA**: una PC con su Claude al 100% y su ChatGPT con lugar no es «sana» para un turno
  de Claude, y al revés (`cuentasAgotadas(cuentasDeLaIA(…))`).
- **`sanearCuentas` tira las cuentas sin `proveedor`**: lo guardado siempre lo trae. Que `cuentasDeLaIA`
  tome una cuenta sin proveedor como de Claude es sólo por si acaso.
- **Los avisos de ChatGPT** son los de Claude con «Tu ChatGPT» y «Codex» (`avisoDeLaPc(…, { ia })`).
  Probados todos los fallos: ninguno dice «Claude».

Probado rompiéndolo: tests/ia-pc-proveedor.test.ts, tests/ia-pc-varias.test.ts (`porIA`) y
tests/chat-ia.test.ts (2b).

**Vive en:** lib/ia-pc-reglas.ts (`pcUsable`, `elegirPc`, `cuentasDeLaIA`, `modeloDelTurno`,
`avisoDeLaPc`) · lib/ia-pc.ts (`pcDe`) · app/api/ia-pc/turno/route.ts · lib/chat-ia.ts («Tu computadora ·
ChatGPT») · lib/mako-turno-app.ts (`iaDeLaPc`) · *2026-10-23, chat «IA del cliente»*

### Qué IA eligió la persona viaja en la VERSIÓN del consentimiento, sin columna nueva (la ola 3, parte c)

El plan decía «una columna en `ia_pc_codigos`» para que el servidor y el programa sepan si la PC se
conectó para Claude o para ChatGPT. No hace falta: el texto que se acepta ya es distinto por IA, así que
su versión también (`CONSENTIMIENTO_DE`). Esa versión ya queda en el código y pasa a la PC al emparejar
(mig 0321, columna `consentimiento`, ≤ 40 caracteres). `iaDelConsentimiento(v)` la lee. Ojo: si cambia el
texto, cambia la versión, y la vieja deja de sacar códigos (como siempre).

- POST /api/ia-pc/codigo frena la versión de ChatGPT mientras `CHATGPT_EN_LA_PC` esté apagada. Sin eso,
  la pantalla podía sacar un código para un programa que no corre Codex.
- El tutorial (`Tutorial`, TusCuentasIA.tsx) va por IA: el nombre, el programa (Claude Code o Codex), lo
  que se acepta, y «¡Listo!» sólo con una cuenta de ESA IA. Los respaldos con la terminal son sólo de
  Claude: el cliente no tiene Node para instalar Codex a mano. «Iniciar sesión» de ChatGPT abre
  `mako://iniciar-sesion?ia=chatgpt`. La 0.4.2 lee sólo el host y abriría el login de Claude: la 0.5.0
  tiene que leer `ia`, y hace falta la versión mínima antes de prender la opción.

**SIN hacer:**

- Que cada PC diga su IA (`iaDelConsentimiento(d.consentimiento)` en /api/ia-pc/estado). Con eso,
  `estadoDeLaPc` («Sin sesión de Claude», «Falta instalar Claude») y la nota de las PC sin cuenta
  (CuentasYDispositivos.tsx:119) dirían «ChatGPT»/«Codex». Va con la parte b, cuando haya PC de ChatGPT.
- «Nuevo dispositivo» dice «esta misma cuenta de Claude» también dentro de una cuenta de ChatGPT. Lo
  arregla la prop `nota` que trae el Ops Center (c23140ed3, rama ops-app-primero-2310, todavía no en
  main). Con eso en main: pasarle la nota por IA desde TusCuentasIA.tsx.
- Volver del instalador (`?computadora=1`) abre el tutorial de Claude: el instalador de la 0.5.0 tiene
  que volver con la IA.

**Vive en:** lib/ia-pc-reglas.ts (`CONSENTIMIENTO_DE`, `iaDelConsentimiento`) · lib/ia-pc.ts
(`crearCodigo`) · app/api/ia-pc/codigo/route.ts · app/integraciones/TusCuentasIA.tsx (`Tutorial`) ·
*2026-10-23, chat «IA del cliente»*

**Vive en:** lib/chat-ia.ts (`cuentasDeIA`) · lib/mako-turno-app.ts (`soloSuOpenAI`) ·
lib/ai-cheap.ts (`cfgDe`, `CHEAP_MODEL`) · lib/conectar-ia-reglas.ts (`CHATGPT_EN_LA_PC`) ·
scripts/ia-pc/medir-codex-mcp.mjs · *2026-10-23, chat «IA del cliente»*

### ChatGPT en la PC: la misma regla que D6a, y la guarda ya no es sólo un test de nombres (23/10/2026, noche)

**La decisión de Martín**, por el Cerebro, el 23/10/2026: *«Sí: ChatGPT en la computadora del cliente igual que Claude,
sólo para que el dueño use su propio ChatGPT en su PC, nunca para atender leads solo.»* Es la regla D6a de Claude
(docs/ia-del-cliente.md §10; AGENTS.md, «la computadora del cliente NUNCA atiende leads sola»), ahora para las dos IA.

**Por qué así, con lo que dice OpenAI** (leído el 23/10/2026; openai.com da 403 a un fetch, así que los Terms salen del
snapshot de Wayback de ese día, «Effective: January 1, 2026»):
- La cuenta es de una persona. Los Terms of Use (openai.com/policies/terms-of-use, «Registration and access») prohíben
  «make your account available to anyone else». Por eso sólo los turnos de quien conectó la PC van a su ChatGPT.
- Lo automático va por API key. Los mismos Terms («What you cannot do») prohíben sacar datos u Output de forma
  automática o programática. Y la doc de Codex manda a usar API key en los flujos programáticos
  (learn.chatgpt.com/docs/auth). La sesión de ChatGPT en automatización la acepta sólo como camino avanzado, para
  automatización privada y de confianza (learn.chatgpt.com/docs/non-interactive-mode y docs/auth/ci-cd-auth).
- El uso del dueño en el momento entra. `codex exec` usa la sesión guardada por `codex login`, y el Output es del
  usuario («Ownership of content»). No hay una línea de OpenAI a favor o en contra de usar Plus o Pro en el trabajo del
  propio negocio. Para compartir en un equipo, OpenAI ofrece el plan Business.
- La vía oficial para que un tercero use el plan de ChatGPT de un usuario («Sign in with ChatGPT») sigue en prueba
  limitada con socios (developers.openai.com/siwc/quickstart). MaKo no la usa: corre el binario oficial en la PC del
  dueño, como con Claude.
- **Sigue siendo zona gris**, igual que D6a: no hay una autorización escrita de OpenAI. Martín decidió sabiéndolo.

**El diagnóstico obvio era el equivocado.** tests/ia-pc-nunca-a-leads.test.ts decía «a la PC llega sólo `turnoApp`, y lo
llaman sólo entradas con sesión», y parecía completo. Un mapa de cinco agentes (un barrido por entradas, otro por lo
automático, otro por el programa de la PC, otro legal, y un crítico) encontró que era un test de NOMBRES:
- `turnoApp` le creía a la persona que le pasaban. Un cron que armara la persona del dueño llegaba a SU PC, con Claude
  o, en Automático, con su ChatGPT. El script del ws3 ya lo hacía sin cookie.
- No veía alias (`{ turnoApp: t }`), ni `turnoDelLead`/`turnoDelCrm` (que lo envuelven con una persona armada), ni una
  segunda llamada a `encolarTurno` en el mismo archivo, ni updates, ni triggers.
- La versión del texto aceptado se guardaba en la PC y **nunca se leía**. Una PC conectada con el texto de Claude, con un
  programa que reportara ChatGPT, recibía turnos de ChatGPT, y se activaba para D6b con esa cuenta.
- Un turno huérfano, de una ruta que murió antes de vencerlo, quedaba tomable 5 minutos. La PC lo pensaba sin que nadie
  lo leyera. Las herramientas no corrían.

**Cómo quedó** (la guarda en código, con su test):
1. **La sesión se mira EN LA PUERTA** (`encolarTurno`, lib/ia-pc.ts, con `laPersonaEstaAdentro` de lib/ia-pc-reglas.ts).
   Antes de tocar la base, lee la cookie de ESTE pedido, y tiene que ser la de quien conectó esa PC (`d.persona`). Si no,
   tira `SinLaPersona`. `turnoApp` la mira antes, para ni leer la PC. La única excepción es la prueba a mano del ws3
   (`pruebaSinSesion`), y sólo con la persona de prueba.
   - **La primera versión la miraba sólo en `turnoApp`, y no alcanzaba.** Una refutación de tres lentes mostró que
     varios saltos pasaban todos los tests: un `?? pcDe(...)`, un alias de `encolarTurno`, un envoltorio dentro de
     lib/ia-pc.ts, un insert con comillas invertidas, un `/*` dentro de un texto (el quitacomentarios del test se comía el
     código que venía después) y una migración larga. Con la sesión en la puerta, cualquier llamador queda frenado al
     correr, no por una regex.
   - **Un `after()` SÍ tiene la sesión.** En Next 16, las cookies se leen dentro de un `after()` de una ruta (la doc de
     `after` lo dice). Es la continuación de lo que pidió la persona. Por eso el test prohíbe `after(` en las entradas
     del turno: nada que corra solo hacia un lead se cuelga de ahí.
   - **Trampa del arnés:** un `import()` diferido en lib/ia-pc.ts NO pasa por el `Module._load` con el que el arnés
     reemplaza lib/auth. Va por el cargador de ESM, carga el lib/auth real y la sesión de mentira no llega. Por eso el
     import es normal.
2. **Una PC contesta sólo con la IA que aceptó quien la conectó** (`iaDeLaPcConectada`). Al guardar el latido (lo que la
   activa para D6b) y al leerla, sólo cuentan las cuentas de esa IA. Como la opción apagada no da el código con el texto
   de ChatGPT, ninguna PC puede ser de ChatGPT hasta que se prenda.
3. **El turno vence cuando el chat deja de esperarlo**, nunca más tarde que TURNO_MS.
4. tests/ia-pc-nunca-a-leads.test.ts reescrito:
   - toda mención de `turnoApp`, de sus envoltorios, de `encolarTurno` y `pcDe`, con alias incluidos;
   - la tabla de turnos por su NOMBRE, con cualquier comilla, con una lista blanca de los que sólo leen;
   - ninguna migración nueva la nombra;
   - todas las carpetas y extensiones de código (.cjs, .cts, .jsx, supabase/);
   - comentarios quitados sólo al principio de línea;
   - sin `after(` en las entradas;
   - `const pc = leidaPc.d;`;
   - la puerta antes de la base;
   - el texto aceptado;
   - el vencimiento.

   El arnés de varias PC lo prueba con lib/ia-pc.ts real:
   - Leo, conectada con el texto de Claude, reporta ChatGPT y no queda activa; Lía, conectada con el de ChatGPT, sí.
   - Un turno vencido no se toma.
   - La puerta frena sin sesión, con otra persona y con la prueba fuera del ws3, y encola con la sesión de la dueña.

   Probado rompiéndolo: 13 roturas de la primera ronda y 10 saltos de la refutación (el pie del test).

**SIN hacer**, con su archivo (lo encontró el mapa; nada de esto manda lo automático a la PC):
- **Codex en la 0.5.0 (bloqueante antes de prenderla).** Una carpeta propia por cuenta (`CODEX_HOME`, como
  `CLAUDE_CONFIG_DIR` en scripts/ia-pc/mako-pc.mjs) más `--ignore-user-config`. Sin eso, los MCP, hooks y conectores del
  dueño entran en cada turno de MaKo, al alcance de un mensaje de un lead.
  Además:
  - apagar `hooks`, `remote_plugin`, `multi_agent`, `goals`, `memories` y la búsqueda web;
  - un `ARGS_CODEX` fijo con su test, que prohíba `--dangerously-bypass-approvals-and-sandbox`, `--yolo`,
    `codex features enable|disable` y `codex mcp add` (escriben en el config.toml del dueño);
  - la medición (scripts/ia-pc/medir-codex-mcp.mjs) ya usa la receta de un cliente: `--ignore-user-config` (no carga
    `$CODEX_HOME/config.toml`, el login sí) e `--ignore-rules`, más el «sin manos» completo validado contra la 0.164.0
    (un nombre que no existe hace fallar a Codex, y `-c web_search="disabled"` pasa; un valor inventado, no).
  - **Trampa medida (23/10, Windows, 0.164.0): `--disable unified_exec` NO apaga `unified_exec`**, ni
    `-c features.unified_exec=false`; `codex features list` lo sigue dando `true`. `shell_tool` sí se apaga. Por eso la
    medición tiene un paso 0 que lista, sin llamar al modelo, lo que sigue prendido. El 3b dice si igual lee archivos: si
    lee, no hay corredor de ChatGPT.
- **La primera cuenta de Claude de una PC usa ~/.claude** (mako-pc.mjs:202 y :249). Los hooks y el CLAUDE.md del dueño
  corren en cada turno. Falta medir `--setting-sources` sin «user» con la suscripción.
- **El RAG embebe el texto del negocio con el OpenAI de la PLATAFORMA**, aunque esté en «sólo su IA» (lib/embeddings.ts:24,
  lib/mako-knowledge.ts:253). Es de D6b, no de la PC.
- **La lista blanca del Closing no mira «sólo su IA»** (lib/anthropic.ts:493, lib/closing.ts:316). Los avisos y la
  post-llamada dejan una fila `vetado:` por intento (lib/plantillas.ts:755, lib/post-llamada.ts:199).
- **Con una PC (de cualquier IA), las automatizaciones del negocio se frenan en silencio.** D6b falla cerrado, y es lo
  correcto, pero nadie lo dice. «Tus cuentas de IA» y Automations tendrían que avisar que con una PC los leads necesitan
  una clave. Es decisión de producto.
- **El token «ejecutar» de la API de MaKo.** Si el dueño programa su propio Codex o Claude Code con ese token, puede
  mover leads fuera de MaKo. No es MaKo usando la PC, pero lo decide Martín.
- Los comentarios de supabase/migrations/0322 dicen «Claude». No se tocan: la migración ya corrió.

**Vive en:** lib/ia-pc-reglas.ts (`laPersonaEstaAdentro`, `iaDeLaPcConectada`) · lib/mako-turno-app.ts (`adentro`) ·
lib/ia-pc.ts (`aDispositivo`, `latir`, `encolarTurno`) · tests/ia-pc-nunca-a-leads.test.ts · AGENTS.md («la
computadora del cliente NUNCA atiende leads sola») · *2026-10-23, chat «IA del cliente»*

### Darle un modelo capaz NO era cambiar el nombre: la capa barata le mandaba campos que rechaza (23/10/2026, tarde)

El Cerebro decidió darle modelo a elegir, «con la misma regla que Claude: el modelo lo elige el ADMIN… por defecto uno
capaz de orquestar herramientas, no gpt-4o-mini». El cambio obvio —pasar el nombre del modelo— **rompía cada turno**:

- **La capa barata manda `max_tokens` y `temperature: 0.2`** en sus tres pedidos (texto, herramientas y el cierre sin
  herramientas). Con `gpt-4o-mini` anda, y por eso nunca se vio: era el único modelo de OpenAI que corría. Los modelos
  con razonamiento (o1/o3, GPT-5 en adelante) contestan 400 a los dos: la referencia de Chat Completions marca
  `max_tokens` como incompatible con ellos y el foro de OpenAI lo reporta para GPT-5. Y el 400 se lee como «se cayó tu
  clave». Ahora el pedido sale de `paramsDeSalida` (lib/ai-cheap-techo.ts): a un razonador, `max_completion_tokens` con
  aire (el pensar sale del mismo tope y sin aire contesta vacío) y sin `temperature`; a los demás, lo de siempre. Lo
  decide el PROVEEDOR además del nombre: `openai/gpt-oss-20b` es de Groq. Y como el supuesto no se pudo medir, si un
  modelo igual rechaza un campo de salida, `chatCheapTools` aprende el OTRO formato de ese 400 y repite el paso una vez
  (`aprenderFormatoSiLoRechaza`, por modelo y por proceso, el molde de lib/gemini-esfuerzo.ts).
- ⚠️ **NO MEDIDO contra los modelos nuevos.** La cuenta de OpenAI de MaKo (la del workspace de la plataforma) contesta
  429 `credit_balance_exhausted` a todo, **y lo contesta ANTES de mirar los parámetros**: los 12 pedidos de prueba
  (tres modelos × cuatro combinaciones de campos) dieron el mismo 429. Sin crédito no se puede saber ni si un campo
  está bien. Y el 22/10 Martín decidió no cargarle crédito («Tenemos Gemini que hace todo eso»): la prueba la pregunta
  aparte el Cerebro, o se sube sin medir. **Lo que SÍ anda sin crédito es `GET /v1/models`** (74 modelos con esa misma
  clave): sirve para saber si una clave TIENE un modelo, no si lo usa bien.
- **El default salió de números publicados, no medidos**: GPT-5.6 Luna (Toolathlon 53,4 contra 42,9 de GPT-5.4 mini,
  las tablas de OpenAI citadas por codingfleet.com; US$0,20/1,20 por millón contra 0,75/4,50). GPT-6 Luna es más nuevo
  y más barato (0,10/0,50) y no tiene número de herramientas publicado: se ofrece, y es el primer candidato a default.

**Lo que encontró una revisión adversarial ANTES de subirlo sin medir** (39 agentes, 30 de 34 hallazgos confirmados).
Lo caro no era el modelo: era todo lo que rodea a una IA que el negocio paga, que con `gpt-4o-mini` nunca se había
ejercitado. Arreglado en el mismo cambio:

- **Un fallo de SU OpenAI se leía «No pude contestar ahora», y una clave rota abría un ticket de bug** para el Cerebro
  («Le avisé al equipo» sobre la clave del cliente). `falloDeSuClave` sólo reconocía Claude. Ahora `falloDeSuOpenAI`
  (lib/mako-turno-app-reglas.ts) separa su cuenta (sin crédito, clave rota: aviso con el botón de su OpenAI, sin
  ticket), el modelo que su cuenta no tiene (403: «Elige otro modelo en el «+»») y el modelo que OpenAI no encontró
  (404: el mismo aviso Y el ticket, porque puede ser un id NUESTRO mal puesto).
- **El gasto contaba dos veces lo que piensa un modelo de OpenAI.** `recordUsage` sumaba `reasoning_tokens` a
  `completion_tokens`, que es lo correcto para Gemini (lo pensado va aparte, sólo en `total_tokens`) y el doble en
  OpenAI (`reasoning_tokens` es un DESGLOSE de `completion_tokens`). Con `gpt-4o-mini` daba 0 y no se veía. Ahora
  `tokensDeSalida` (lib/ai-cheap-techo.ts).
- **Los tres modelos no tenían precio** y caían a `DEFAULT_PRICE` (5/25): el gasto de un negocio con GPT-5.6 Luna se
  anotaba unas 25 veces más caro. Y el historial los nombraba «GPT-5» o con el id crudo (`modeloLegible`,
  lib/ia-labels.ts, ahora con los nombres del selector).

**Lo que quedó SIN hacer**, con dónde vive:

1. **Medir** (necesita crédito): `npx tsx --conditions=react-server scripts/medir-openai-herramientas.mts gpt-5.6-luna
   gpt-6-luna gpt-6.1-sol` desde el clon. Usa el MISMO cuerpo y plazo que la capa barata. Si GPT-6 Luna acierta igual,
   pasa a ser el default (`MODELO_SU_OPENAI_DEFAULT`). Después, la prueba de punta a punta del turno.
2. **Automático y WhatsApp siguen en `gpt-4o-mini`, a propósito hasta medir**: si el default está mal, a un negocio que
   sólo tiene su GPT se le caería CADA turno; hoy `gpt-4o-mini` anda. Viven en lib/anthropic.ts (la rama del registro
   pasa `modelos: { [ref.provider]: ref.model }`, y el default del doer es Gemini) y en lib/mako-doer-in.ts (el modelo
   escrito a mano).
3. **Sin plazo**: cada pedido de `chatCheapTools` tiene 45 s, un timeout se reintenta idéntico, y nada lo topa contra los
   420 s de la ruta del chat (`chatCheapToolsCascade` no acepta `timeoutMs` ni `hastaMs`). Un modelo que razona lo hace
   más probable. El molde ya existe en `chatCheapCascade` (`plazoDeIntento`, `MIN_INTENTO_MS`).
4. **lib/costos-ia.ts cuenta el gasto de la OpenAI de un negocio como costo de MaKo**: `costoDe` sólo reconoce la marca de
   la clave de Anthropic del negocio. Ya pasaba con el escalón OpenAI de la cascada; esto lo agranda.
5. **Ningún modelo guardado por negocio** (como `ia.su_claude.modelo` de su Claude): lo que elige el admin vive en el
   estado de la pantalla (app/second-brain/useChatCliente.ts) y se pierde al recargar.
6. **Una respuesta cortada por `finish_reason: length`**: vacía, el turno pierde el porqué (queda «centinela»); con
   `tool_calls` a medias, la herramienta corre con `{}` (lib/ai-cheap.ts, chatCheapTools).
7. **«Probar mi clave» de OpenAI no mira si la clave tiene el modelo por defecto** (lib/su-clave.ts). `GET /v1/models`
   lo contesta sin gastar crédito.

**Vive en:** lib/ai-cheap-techo.ts (`paramsDeSalida`, `aprenderFormatoSiLoRechaza`, `tokensDeSalida`) ·
lib/chat-ia-reglas.ts (`MODELOS_SU_OPENAI`, `MODELO_SU_OPENAI_DEFAULT`) · lib/chat-ia.ts · lib/anthropic.ts
(`modeloSuOpenAI`) · lib/mako-turno-app.ts + lib/mako-turno-app-reglas.ts (`falloDeSuOpenAI`) · lib/anthropic-usage.ts ·
lib/ia-labels.ts · scripts/medir-openai-herramientas.mts · *2026-10-23, chat «IA del cliente»*

## Gemini en la PC: no, y la PC que no contesta ahora deja tiempo para su clave (24/10/2026)

**El pedido** (Martín, por el Cerebro): *«qué pasó con habilitar la opción de GPT en la PC? Y veo que agregaste Gemini,
podríamos hacer eso también en PC...»*.

**ChatGPT en la PC: la traba NO es «OpenAI sin crédito».** Esa es la cuenta de OpenAI de MaKo, y en la PC corre la suscripción
del dueño. Medido el 24/10: Codex 0.164.0 está instalado en la PC de Martín, pero `~/.codex` sólo tiene `tmp` (no hay
`auth.json`): **falta su `codex login` con «Sign in with ChatGPT»**, que es su sesión y no la inicia un chat. Después, en este
orden: `node scripts/ia-pc/medir-codex-mcp.mjs` (tres turnos de su cuenta), el corredor de Codex en el programa 0.5.0 con su
carpeta propia (`CODEX_HOME` + `--ignore-user-config`, bloqueante: ver «ChatGPT en la PC: la misma regla que D6a») y recién ahí
`CHATGPT_EN_LA_PC = true`. El servidor ya está (partes a, c y d de la ola 3, invisibles con la opción apagada).

**Gemini en la PC: no se puede con la suscripción del dueño, y no es un problema de código.**
- Desde el **18/06/2026** Gemini CLI no atiende el «Login with Google» de cuentas personales (Code Assist for individuals,
  Google AI Pro y Ultra). Fuente: developers.google.com/gemini-code-assist/docs/deprecations/code-assist-individuals,
  «Last updated 2026-10-09», leída el 24/10. Lo que sigue andando es la clave de API paga, Vertex o una licencia Standard o
  Enterprise (con su propio cronograma de baja). Con una clave, su Gemini ya trabaja en la nube y las 24 horas (IA16): en la
  PC no agrega nada.
- Su reemplazo, Antigravity CLI, sí acepta cuentas personales, pero su cláusula 6 prohíbe usarlo «in connection with products
  not provided by us», y hay suspensiones reportadas (antigravity.google/terms, sin fecha, leída el 24/10). Sería exponer la
  cuenta de Google del cliente.
- La clave GRATIS de Gemini entrena con lo que se le manda y tiene revisión humana (ai.google.dev/gemini-api/terms): un chat
  del dueño con datos de sus leads no va ahí. Es el aviso que ya muestra «Conectar tu IA» (`AVISO_GEMINI_GRATIS`).
- **El diagnóstico obvio era el equivocado:** «agregaste Gemini» se leía como «ya hay una pieza que poner en la PC». La pieza
  de IA16 es la clave; la PC necesita una suscripción que se pueda correr, y Google la cerró.

**Lo técnico, por si algún día vuelve** (Gemini CLI v0.65.0, docs de main al 24/10; investigado, no probado):
- Sin `--input-format`: un proceso por turno (`-p` + `--output-format stream-json`), como `codex exec`; `--resume` sí anda
  en headless.
- El MCP sale SÓLO de settings: `GEMINI_CLI_HOME` (mueve también `oauth_creds.json`) o `GEMINI_CLI_SYSTEM_SETTINGS_PATH`, más
  `--allowed-mcp-server-names`.
- **Trampa:** `tools.core: []` apaga también el MCP de MaKo (genera un DENY `*` que le gana a `trust`). Lo que sirve es una
  policy con `--policy`: deny `*` y allow `mcpName="mako"`.
- En headless toda aprobación es DENY: el MCP necesita un allow explícito, nunca `--approval-mode=yolo` (aprueba también las
  propias, y los términos piden no saltear confirmaciones humanas).
- `privacy.usageStatisticsEnabled` viene en true. No hay binario de Windows (npm, Node ≥ 20).

**El choque de TIPOS que el merge no marcó.** Con IA16 en main, `IaDelCliente` trae `gemini`, y el tutorial de la computadora
(`TusCuentasIA.tsx`) indexaba `PROGRAMA_IA_PC` y `CONSENTIMIENTO_DE` (que son de Claude y ChatGPT) con esa IA. El merge salió
limpio en texto y roto en tipos. Ahora el tutorial abre sólo con una IA de la PC (`iaDeLaPcPara`, lib/conectar-ia-reglas.ts):
Gemini ni se ofrece. La regla: **cuando una unión crece en main, se buscan los `Record` de la rama indexados con ella.**

**El respaldo de una PC que no contesta (el caso de Brigitte, del lado de la PC).** El vigía levantó el 23/10 que a Brigitte
Eberlin su Gemini le dio timeout y no había nada detrás; eso es la nube, y lo arregla Automations. En la PC pasaba lo mismo de
otra forma: la espera se comía todo el plazo de la ruta (240 s de 300) y, si la PC no contestaba, `'tarde'` cortaba sin
probar su clave porque ya no quedaba tiempo. Ahora, en Automático y con una clave propia (`claveDeIAPropia`), la PC deja
`RESERVA_RESPALDO_MS` (90 s) libres y `probarSuClaveTrasLaPc` decide. El respaldo es siempre su IA: `chatClaudeTools` con
«sólo su IA» y sin el Claude de MaKo. Elegida la computadora, no hay respaldo (eligió ésa).

**SIN hacer:**
- El `codex login` de Martín y la medición (arriba). El corredor de Codex en el programa 0.5.0.
- Si un negocio sin clave propia y sólo con su PC se queda sin respuesta porque la PC tardó, no hay respaldo posible: no tiene
  otra IA. Se le dice («tu computadora no contestó a tiempo»); no se le presta la de MaKo.
- El selector «+» sigue sin ofrecer «Tu Gemini» por clave (lo de IA16: lib/chat-ia.ts, el Cerebro lo repartió).

**Vive en:** lib/ia-pc-reglas.ts (`PROVEEDORES_PC`, `esProveedorPc`, `esperaDelTurno`, `RESERVA_RESPALDO_MS`, `probarSuClaveTrasLaPc`) ·
lib/conectar-ia-reglas.ts (`iaDeLaPcPara`, `pcListaPara`) · lib/mako-turno-app.ts (`reservado`) · lib/ia-del-negocio.ts
(`claveDeIAPropia`) · app/integraciones/TusCuentasIA.tsx (`abrirTutorialEn`) · tests/ia-pc-respaldo.test.ts ·
*2026-10-24, chat «IA del cliente» (claude1)*

## Tests que mienten con la máquina cargada: los dos del instalador de la PC (24/10/2026)

**Síntoma.** Con 28 archivos de test a la vez y ~4 GB libres, dos tests de «MaKo en tu computadora» dieron rojo:
- tests/ia-pc-binarios.test.ts, «el instalador: sin el ejecutable…»: `spawnSync … ETIMEDOUT` (el hijo pasa los 90 s);
- tests/ia-pc-segunda-revision.test.ts, «el programa: "confirmar"…»: la salida del programa llega `null` (no terminó en los
  8 s) y el assert dice «sale con 1: el instalador deja corriendo lo de antes», que se lee como un bug del instalador.

**Causa.** Ninguna del código: los dos levantan un proceso hijo con un plazo fijo, y con la máquina cargada el hijo no llega.
Corridos solos, 21/21. La misma noche la app se colgó con 1,9 GB libres.

**La regla.** Un rojo de un test que lanza un proceso con plazo (`execFileSync … timeout`, un `correr(…, ms)`) se corre SOLO
antes de buscar el bug; si solo pasa, es la máquina. El aviso quedó escrito arriba de cada test, que es donde lo ve quien lo
corre. Lo que queda sin hacer: que la etapa de tests de `antes-de-subir` reintente sola, una vez y de a uno, los que fallan
por plazo (scripts/antes-de-subir.mjs).

**Vive en:** tests/ia-pc-binarios.test.ts · tests/ia-pc-segunda-revision.test.ts · *2026-10-24, chat «IA del cliente» (claude1)*

## La réplica del ws9 sin IA: había a dónde caer, y el plazo no dejaba llegar (26/10/2026)

**Síntoma** (Landings, logs de Vercel, 05:52 UTC): `/api/landing-generator/replicar` en el espacio de MaKo dejó 17 de 20
secciones de la réplica de una página SIN IA, en 135 s. Errores: «gemini · cuenta 3: The operation was aborted due to timeout»
y «gemini · cuenta 4: This model is currently experiencing high demand».

**El diagnóstico obvio era el equivocado:** «la cascada de Gemini no tiene a dónde caer». En el ws9 es cierto que no hay OTRA IA:
la OpenAI de MaKo no tiene crédito (decisión de Martín, 22/10), Claude está vetado para `landing-editor` (no está en la lista
blanca; el crédito de la plataforma es sólo para el onboarding), Groq quedó para las notas de voz y Cerebras, Mistral y
OpenRouter se fueron. Pero la cascada SÍ tenía una salida gratis: el respaldo de modelo, `gemini-flash-lite-latest`
(`MODELOS_RESPALDO`, medido el 16/08 y el 07/10 que contesta cuando `flash-latest` da «high demand»). **Nunca llegaba a probarse:**

- Cada tanda de 3 secciones tiene 42 s de IA (`PLAZOS.secciones.ia`, lib/editor-landing/ia.ts) y el intento recibía TODO lo que
  quedaba (`plazoDeIntento`). Un `flash-latest` colgado se comía los 42 s; el respaldo no tenía tiempo.
- Un timeout o un 503 es «transitorio» y se reintentaba en el MISMO modelo (espera de 1,5 s y otro cuelgue).
- La tanda siguiente volvía a empezar por el colgado: nadie recordaba que ese modelo estaba saturado.
- Y la réplica terminó en 135 s con un plazo de 240: sobraban 105 s y no había segunda vuelta.

**Lo que cambió** (vale para TODO lo que pasa por la cascada, no sólo el Web Generator):

1. **Un modelo saturado no se reintenta si hay a dónde ir**: «high demand», «overloaded» o 503 (`esSaturacion`). Un 429 NUNCA
   cuenta: es la cuota de UNA cuenta, y la arregla otra cuenta.
2. **El modelo que DIJO estar saturado queda anotado 3 minutos en el proceso** (lib/ia-saturacion.ts, el molde de
   lib/gemini-esfuerzo.ts) y `modelosAProbar` lo pone AL FINAL: el pedido siguiente, de cualquier negocio, empieza por el
   respaldo. La saturación es de Google, no de un negocio: la memoria compartida no guarda ningún dato de nadie. Anotan
   `chatCheap` y el turno con herramientas (MaKo en WhatsApp), SÓLO con el 503; los tres lazos que rotan modelos (texto,
   herramientas y audio) leen el orden.
3. **Un cuelgue (timeout) queda anotado en el PEDIDO, no en el proceso** (`conMemoriaDelPedido`): la réplica entera corre con
   su memoria, y la tanda siguiente y la segunda vuelta de ESA réplica empiezan por el respaldo.
4. **La réplica da UNA segunda vuelta** a las secciones que quedaron sin IA, mientras quede plazo para una tanda entera.

**Medido** con la cascada real contra un Google de mentira (tests/_ia-saturacion-hijo.ts): un 503 pasa al respaldo sin
reintentar el mismo modelo y el pedido siguiente empieza por `flash-lite`; un timeout no marca a nadie; adentro de una réplica,
la tanda que sigue a un cuelgue empieza por el respaldo, y afuera no; la última opción real sí reintenta su 503, también con una
red pedida que no corre. 12 roturas, cada una cae (la de «un 429 no cuenta» dio verde la primera vez: el mensaje de cuota del
test no traía ninguna palabra de saturación).

### La primera versión tenía dos errores que vio la revisión del tren-l (26/10/2026)

- **Reservarle 15 s a la opción siguiente convertía un pedido LENTO en uno SATURADO, para todos los negocios.** El intento pedía
  lo que quedaba menos `MIN_INTENTO_MS`: una tanda de 3 secciones (7.400 tokens, 42 s de plazo) quedaba con 26,8 s, se cortaba
  sana a los 27-30 s (lo normal para ese tamaño: el hero solo tarda 16-21 s) y, como 26,8 s pasaba el umbral fijo de 25 s, el
  corte anotaba `flash-latest` como saturado. Tres minutos de todo el proceso empezando por `flash-lite`, sin que Google tuviera
  nada. **La regla:** un timeout cuenta como saturación sólo si el intento tuvo TODO el plazo que su tamaño necesitaba
  (`fallaDeSaturacion(mensaje, plazoDelIntento, plazoEsperadoMs(maxTokens))`, la misma fórmula que escala `chatClaude`). Y la
  reserva se sacó: lo que hace llegar al respaldo es el 503 que no se reintenta y el modelo anotado, no recortarle el plazo al
  primero.
- **«Hay otra opción» contaba proveedores SIN clave.** `orden` sale de `ordenarPorCuota`, que no mira si el proveedor tiene
  cuentas: un negocio con sólo su Gemini tiene `['gemini', 'openai']`, y en `flash-lite` (su última opción real) el código creía
  que quedaba OpenAI. Su 503 no se reintentaba y la cascada devolvía vacío en dos pedidos. **La regla:** las cuentas de cada
  proveedor se cargan UNA vez antes del lazo (`instanciasDe`), y «otra opción» es otro modelo, otra cuenta, otro proveedor CON
  clave o la red de la plataforma cuando de verdad corre. `ultimoRecurso` usa lo mismo: tenía el error desde antes.

### Y la segunda versión, dos más que vio la verificación del tren-m (26/10/2026)

- **Ningún umbral de plazo separa un modelo colgado de un pedido sano.** La segunda versión contaba un timeout si el intento
  tuvo «su plazo necesario», y en el turno con herramientas el necesario era el timeout DEL QUE LLAMA: la red de MaKo en
  WhatsApp corta a los 10 s (lib/mako-doer-in.ts), un paso sano tarda 12, y eso marcaba `flash-latest` 3 minutos para TODOS los
  negocios. Lo mismo con los 30 s por default de `chatCheap` (pasos sanos medidos de 32 s) y con lib/graficos-ia-red.ts y
  lib/offer-ia.ts, que recortan el plazo. **Lo obvio era afinar el umbral; la regla es otra: al proceso lo marca sólo lo que
  el proveedor DICE (503, «high demand», «overloaded»), nunca un timeout.** El cuelgue se recuerda donde no daña a nadie: en
  el pedido (`conMemoriaDelPedido`, con `AsyncLocalStorage`), que en la réplica abarca todas sus tandas.
- **La red «pedida» no es la red que «corre».** `hayRed` miraba `redDePlataforma` y «sólo su IA», pero abajo la red además se
  corta con datos de clientes (`pii`) y en el super admin. El AI Step que le contesta a un lead va con `pii: true`: con sólo su
  Gemini, la cascada creía que quedaba la red, no reintentaba el 503 de su última opción y el lead iba a hand-off. **La regla:**
  «otra opción» se le pregunta a la MISMA función que la ejecuta. ⚠️ La primera corrección copió los cortes a mano y se olvidó
  del más grande: `provsGratisDePlataforma` devuelve `[]` fuera del super admin (la red no corre para ningún negocio desde el
  22/10), y el bloque de la red sólo entra afuera del super admin. O sea, la red gratis no corre NUNCA para un cliente, y
  `hayRed` daba true para cualquiera sin datos de clientes: un negocio con sólo su Gemini perdía el reintento que producción
  tenía. Ahora `hayRed` llama a `provsGratisDePlataforma` (hoy da false siempre), y el crédito de lo interno de MaKo se mide
  igual: `hayCreditoDeLaPlataforma` es la misma cuenta que hace su puerta (claves cargadas, sin pausa, sin agotar).
- ⚠️ Lo que decía esta entrada en la segunda versión era falso: «la segunda vuelta empieza por el respaldo porque el cuelgue con
  plazo completo lo anotó». Una tanda de 7.400 tokens con 42 s nunca tuvo los 88,8 s «necesarios»: no se anotaba, y la segunda
  vuelta volvía a empezar por el colgado. Ahora lo anota la memoria del pedido.

**Otras áreas con la misma cascada:** no hay otra forma «sin salida»: todas pasan por `chatCheapCascade`, `chatCheapTools` o la
rotación del audio, y las tres arman la lista con `modelosAProbar`. Las features con `fallback: []` o `sinRespaldoDeModelo` siguen
sin respaldo A PROPÓSITO (no se degradan): para ellas el arreglo es sólo que el intento no se coma el plazo.

**Lo que decidió Martín (26/10/2026, en el Centro: «1. Claude de la plataforma»):** el ws9 no tenía una segunda IA, y ahora su
último recurso es el crédito de Claude de la plataforma, SÓLO para lo interno de MaKo. Tres líneas más en `CREDITO_HABILITADO_PARA`
(lib/veto-claude.ts) con `soloLaPlataforma`: `landing-editor` (generar y replicar), `landing-editor-ia` (editar) y
`landing-analyst` (el analizador). Cómo no gasta de más:
- **Nunca primero:** la cascada lo llama DESPUÉS del lazo de las gratis (sus Gemini y el respaldo de modelo), y sólo si queda un
  intento entero de plazo. La red de la plataforma no corría en el super admin: sin esto, ahí no había nada. Con el crédito
  esperando, el 503 de `flash-lite` NO se reintenta (cuenta como «otra opción», si está de verdad): los tres reintentos le
  dejaban 15-17 s, que no alcanzan para una tanda.
- **El mismo tope:** el `maxTokens` de la tarea viaja tal cual (sin él, la puerta pedía 1.024).
- **Registrado:** cada llamada queda en `anthropic_usage` con la marca del crédito y «último recurso: las gratis no contestaron»
  en el motivo; lib/costos-ia.ts no la suma como gasto de MaKo y la cuenta aparte (`delCredito`), para que se vea cuánto se usa.
  ⚠️ También la que se CORTA: un timeout después de mandar no traía `usage` y no dejaba fila, pero Anthropic puede haber cobrado.
  Ahora queda con 0 tokens, la marca y «puede haber gastado hasta N tokens de salida».
- **Un negocio no:** el veto pide `esLaPlataforma`, la puerta (`conCreditoDeLaPlataforma`) lo mira ANTES de leer las claves, y
  la cascada sólo entra en el espacio de MaKo. Tres frenos, y el test rompe cada uno.

⚠️ Lo que sigue sin resolver: el crédito recibe el plazo que QUEDA. Si un CUELGUE (no un 503) de las gratis se come la tanda,
no llega a probarse en esa tanda; sí en la segunda vuelta de la réplica.
Y sin la reserva, un `flash-latest` COLGADO (no un 503) se sigue comiendo el plazo de LA tanda en que se cuelga: esa sección
sale en la segunda vuelta, que empieza por el respaldo porque el cuelgue quedó en la memoria de la réplica.

**Trampa del arnés:** el timer de `AbortSignal.timeout` no mantiene vivo a Node. Con un pedido colgado como única espera, el
proceso hijo terminaba con código 0 sin imprimir nada (un `setInterval` lo sostiene mientras corre).

**Vive en:** lib/ia-saturacion.ts (`conMemoriaDelPedido`) · lib/ai-cheap.ts (`plazoDeIntento`, `modelosAProbar`, `hayRed`,
`chatCheap`, `chatCheapTools`) · lib/editor-landing/replicar.ts (la segunda vuelta y la memoria de la réplica) ·
tests/ia-saturacion.test.ts · tests/_ia-saturacion-hijo.ts ·
*2026-10-26, chat «MaKo recomienda» (claude5), a pedido del Cerebro*

---

## Cada fila de `anthropic_usage` es un pedido para la cuota del día: una marca nueva no puede repetir la de otra (27/10/2026)

**Síntoma** (al entregar la rama de MaKo en WhatsApp, leyendo el código): un 429 de Gemini que cubría `flash-lite` dejaba DOS
filas del mismo pedido: `rebote429:<modelo>` (`anotarRebote429`) y `rebote:<modelo>`, la nueva que cuenta las bajadas de modelo
desde la base.

**La trampa:** `plegarUso` (lib/ia-cuotas-calculo.ts) suma CADA fila como un pedido del día, también las de 0 tokens. Es a
propósito: un rebote viajó y el proveedor lo contó. Con dos filas por pedido, la barra de la cuota se infla y `ordenarPorCuota`
deja antes esa cuenta.

**La regla:** antes de escribir una fila de marca nueva, se mira si otra fila ya anota ESE pedido. Si no es una llamada que
contestó, va también en `MARCAS_NO_CONTESTO` (lib/su-clave-reglas.ts).

**Vive en:** lib/ai-cheap.ts (`chatCheapTools`, la condición `tipo !== 'cuota'`) · lib/ia-cuotas-calculo.ts (`plegarUso`) ·
tests/doer-modelo.test.ts ·
*2026-10-27, chat «MaKo en WhatsApp: conexiones» (claude4)*

---

## MaKo inventaba funciones, y el pedido no le llegaba a nadie (27/10/2026, claude5)

**Síntoma:** Leandro (ticket 874749710-14): MaKo le describió «un bloque de Instagram con tope de comentarios» que no existe.
Automations ya lo frenaba (`lugarInventado`, lib/flujo-ia-intencion.ts) y ofrecía un botón; los otros chats, nada.

**Lo obvio era el equivocado:** agrandar `lugarInventado` con más palabras. Un detector de frases inventadas sólo ve las
inventadas que alguien ya vio; la próxima trae otro nombre. **La regla:** el modelo dice que no existe y lo MARCA
(`[[no-existe: …]]`, `REGLA_NO_EXISTE` de lib/no-existe.ts, y `reglaNoExisteEn(campo)` para los chats que contestan en
JSON); el CÓDIGO saca la marca, levanta el pedido sin preguntar y escribe la línea con el número (lib/no-existe-server.ts).
Así el modelo nunca promete ni inventa un número de ticket, y la persona nunca ve la marca.

- **Dónde va:** el Ops Center (`turnoApp`: también el teléfono, el CRM y el Analyst del lead), Offer y el onboarding, «Discutir»
  del Web Generator, los chats del Image Editor y del Video Editor, y Automations (su `falta` sale sola; el botón «Pedírselo al
  equipo» queda de respaldo si el ticket no salió). tests/mako-no-existe.test.ts exige la regla y el procesado en cada uno.
- **Trampa:** los editores de imagen y video se quedaban con la PRIMERA línea de `resumen`: la marca se saca ANTES de cortar.
- **Un pedido es UN ticket:** `refDeNoExiste` (negocio, chat y el pedido sin mayúsculas ni tildes).
- **WhatsApp** (mako-wa-conexiones, P3) usa el mismo criterio para lo que FALLA (ahí se propone el ticket, hay algo que
  confirmar); lo que no existe en el grupo puede usar `conPedidoDeNoExiste` con `actor: whatsapp:…` y `canal: 'whatsapp'`.

**Sin hacer:** la corrida con el MODELO REAL (`scripts/probar-no-existe.mts`): el clasificador de permisos negó leer las claves
locales («Credential Exploration»), así que la corre quien tenga el permiso. El Dashboard no se tocó: no es un chat donde se
pidan funciones (arma análisis de los datos).

## «Eso es una distracción total»: MaKo descalificaba lo que le pedían (27/10/2026, claude4, la crítica de Leila)

**Síntoma:** a «¿tenemos registro de cumpleaños de los clientes activos?» MaKo le contestó a Leila «eso es una distracción
total». La frase no está en el código: sale de la persona (lib/mako-persona.ts: «honestidad radical», «el orden importa más que
las tácticas»), que se edita desde la app y la guardada le gana al default.

**Lo obvio era el equivocado, dos veces.** Corregir la persona no alcanza (la de cada negocio puede estar guardada), y ponerlo en
`MAKO_NUCLEO` tampoco: su comentario decía «Núcleo FIJO — reglas duras, no editables» y NO lo es, porque `buildSystemPrompt` lo
lee con `getPromptText('mako.nucleo', MAKO_NUCLEO)` y un override guardado lo reemplaza entero (el comentario ya lo dice).
**La regla:** lo que no se puede sacar va como constante del código DESPUÉS de lo editable: `REGLA_NO_DESCALIFICAR`
(lib/no-existe.ts) en `buildSystemPrompt` (lean y completo: la app, WhatsApp y su red, /api/mako-doer) y en el asesor de
WhatsApp (lib/whatsapp-advisor.ts). Nunca «distracción», «no importa», «no es prioridad»: primero contesta, si no existe lo dice
y propone cómo, y lo urgente va después como sugerencia. tests/mako-no-descalifica.test.ts, con la pregunta de cumpleaños.

**Sin hacer:** medirlo con el MODELO REAL: `scripts/probar-no-existe.mts` ya trae la pregunta de cumpleaños con la persona de
verdad y `descalificaElPedido`, y no se corrió (pide las claves de IA y registra el uso en la base). El campo de cumpleaños
lo hace CRM/Chats.

## Los «no puedo» falsos de la app: la herramienta existía y no viajaba (27/10/2026, claude4, Leila)

**Síntoma:** MaKo le dijo «no puedo» a Leila con cosas que sí hace: editar las cuotas de un lead, corregir su plan de pagos
(terminó en el ticket #13 como «no existe»), guardar los datos de una constancia fiscal. El diagnóstico (sólo lectura, con el
selector real) mostró que en los tres casos la herramienta no llegaba al turno.

**Lo que no se ve en el modelo, se ve en el selector:** las herramientas de un turno son una SELECCIÓN (clasificador +
presupuesto de 12.000). Medirlo con `deSiempre: []` miente: libera presupuesto y da otra selección; el test usa
`MAKO_TOOLS` + `MAKO_ACCION_TOOLS` de verdad.

- **El plan de pagos sin la palabra «cuota»** (lib/mako-intencion.ts): «las fechas y cantidades de pago», «cada quincena», «la
  mensualidad de Ana», «el plan de pagos» no sumaban cobros. Ahora son el tipo `plan` (editar_venta_lead y editar_cuota
  primero; `guardar_cuotas` también marca GANADO). Trampa: `DEL_PLAN_COBRO` tomaba «el plan de pagos» como la tab Plan. La
  mensualidad de MaKo («mi mensualidad») no entra.
- **La ficha en «Editar»** (lib/mako-analyst-lead*.ts): la pista de diseño va adelante a propósito, pero se adueñaba de un DATO.
  `pistaDeEdicion` elige la pista del dato si es un cobro que no nombra la vista. Sin «ficha» en esa pista: es una palabra de la
  vista. Además, en «Editar» la pantalla bloquea los montos (bloques-cobro.tsx, `bloqueado={editando}`): MaKo ahora lo dice.
- **Los datos fiscales** no sumaban ningún área: `editar_dato_deal` (cobros) no llegaba ni pedido explícito. Y con la constancia
  ADJUNTA el turno es «pensar», donde lo que escribe no viaja por diseño («la ofrece»): sin sus NOMBRES, MaKo no tenía qué
  ofrecer y decía «no puedo». **La regla:** `herramientasDelTurno` devuelve `ofrecibles` (los nombres, sin esquema) y el turno
  de la app los dice en el system. WhatsApp todavía no los usa.
- **«Anotado» sin escribir nada** (el horario, dos veces): `afirmacionesDeHecho` sólo miraba pretéritos; ahora también
  «Anotado», «queda guardado», «lo recordaré», mirando la oración ENTERA (en «Anotado: X» el «:» no presenta, afirma).

**Sin hacer:** en la PANTALLA, un aviso junto a los montos bloqueados en «Editar» (es del CRM: app/crm/lead-view/ficha/pagos/
bloques-cobro.tsx:504). Corregir un dato YA cargado del perfil desde el chat: `guardar_campo_perfil` sólo completa vacíos
(negocio.def.ts:431), se corrige en el Archivero. WhatsApp: la edición de montos con una foto (regla 9, media → pensar) es de
«MaKo en WhatsApp». Los datos de Nadia (lead 2605, 12 cuotas de 4235.29) son producción de ws 11: los decide Martín.
## Con la computadora del cliente APAGADA: qué deja de andar y qué no (27/10/2026, Infra)

Aaron (llamada del 26/10) preguntó qué pasa con la PC del usuario apagada. Leído en el código (no probado apagando una PC):

**Cómo lo sabe el servidor.** La PC late cada 30 s (`LATIDO_MS`); a los **90 s sin latido** está «Sin conexión»
(`EN_LINEA_MS`, lib/ia-pc-reglas.ts). Con más de 90 s apagada, el turno **ni se encola**: falla como `'apagada'` y va al
respaldo (lib/mako-turno-app.ts). Si se apagó dentro de esos 90 s, se encola y vence a los 35 s sin que nadie lo tome
(`SIN_TOMAR_MS`) o a los 75 s sin latido si ya lo había tomado (`SIN_LATIDO_MS`). **No espera a que vuelva** y no se le avisa al
dueño cuando vuelve: lo que pidió con la PC apagada no se hace después.

⚠️ **El diagnóstico obvio era el equivocado: «si la PC está apagada, contesta otra IA».** Una PC conectada cuenta como «su
IA» AUNQUE ESTÉ APAGADA (`negocioConPc` mira que esté activa, no que lata; `negocioConSuIA` en lib/ia-del-negocio.ts). El
negocio sigue en D6b, «sólo su IA»: nunca Groq, nunca la cascada barata, nunca el Claude de MaKo (salvo el crédito de Claude
que Martín le asigna a un negocio, que entra como su clave: lib/anthropic.ts). El respaldo es SU clave, si tiene.

| Qué | Con la PC apagada |
|---|---|
| El chat de la app en Automático | Contesta su clave (OpenAI, Gemini o su Claude). Sin clave: «Tu computadora está apagada: préndela y mándamelo de nuevo» |
| El chat con «Tu computadora» elegida en el «+» | Error, sin respaldo: eligió ésa |
| «Tu computadora» en el selector | **Se sigue ofreciendo**: `pcDe` no mira si está en línea (lib/chat-ia.ts) |
| El grupo de WhatsApp del dueño | Su OpenAI y después su Claude, por clave; sin clave, el cartel de «préndela» |
| Notas de voz | Nunca usaron la PC: las escucha su OpenAI o Gemini |
| Leads, Automations, nutrición, avisos, crons, Plan, reuniones | Nunca dependieron de la PC (`tests/ia-pc-nunca-a-leads.test.ts`) |
| Descargar e instalar el programa | Es del servidor: URL firmada de 600 s del bucket privado `ia-pc` |

**Y no toca Storage.** El programa de la PC sólo habla con `/api/ia-pc/*`: no sube ni baja nada de ningún bucket, así que
los buckets públicos no tienen nada que ver con que la PC esté prendida. Fuera de `ia-pc`, lo que sí necesita una PC prendida
es lo que corre en una extensión o un worker: el puente a Google Flow y el montaje de video.

**Sin hacer:** sacar «Tu computadora» del selector mientras no late (o marcarla «apagada»); avisarle al dueño lo que pidió
con la PC apagada.

**Vive en:** lib/ia-pc-reglas.ts (`LATIDO_MS`, `EN_LINEA_MS`, `SIN_TOMAR_MS`, `SIN_LATIDO_MS`, `pcUsable`) · lib/ia-pc.ts
(`encolarTurno`, `negocioConPc`, `pcDe`) · lib/mako-turno-app.ts · lib/chat-ia.ts · scripts/ia-pc/mako-pc.mjs ·
*27/10/2026, chat «Infra» (claude5)*

## «Chrome me lo marca como malware»: antes del aviso del sistema está el de Chrome, y el botón desaparece al tocarlo (27/10/2026)

**El síntoma:** Leandro, en la llamada del 26/10: Chrome le frenó el instalador de MaKo como peligroso, y el botón de descargar no
decía nada.

**Lo que no era obvio:**
- La ayuda decía sólo lo del sistema («Windows protegió su PC», Gatekeeper en Mac), pero ANTES pasa Chrome: con un programa sin
  firmar y nuevo, frena la descarga. `AVISO_CHROME` va primero en `avisoAlAbrir`. Lo que lo destraba de verdad es la firma
  (scripts/ia-pc/firmar-windows.mjs, lista), y el certificado lo compra Martín.
- Un «Descargando…» en el botón no se ve nunca: las tres pantallas que lo usan lo CAMBIAN por «Ya lo instalé: conectar» en el
  mismo clic. El estado va en lo que queda: el título de la tarjeta y la frase de la caja dicen «Se está descargando».

**Vive en:** `lib/ia-pc-reglas.ts` (`AVISO_CHROME`) · `app/integraciones/CuentasYDispositivos.tsx` (`avisoAlAbrir`) · `TusCuentasIA.tsx` ·
`app/_chat/app-de-escritorio.ts`

## MaKo no lee los chats de Claude o ChatGPT del cliente: no hay nada que ignorar todavía (27/10/2026)

**El pedido:** Leila, en la llamada del 26/10 (Fathom 876470842, 00:06:52–00:08:01): tiene chats y proyectos PERSONALES en su
Claude y su ChatGPT y no los quiere en el contexto de MaKo. Martín le prometió un botón para ignorar cada chat.

**Medido:** MaKo no los lee. `mako-pc` (scripts/ia-pc/mako-pc.mjs) tiene como regla no tocar `~/.claude` ni el Keychain: sólo corre
`claude` con lo que MaKo le pide. Y lo único que lee chats (`leerTurnos`, `leerCarteros`) es el Ops Center de MaKo, con los chats de
las cuentas del equipo, no los de un cliente. Lo personal de Leila no entra al Second Brain ni al contexto. El botón no se armó.

**La regla:** si algún día MaKo empieza a leer los chats o los proyectos del cliente (para usarlos como contexto), eso nace con el
botón de ignorar cada uno, y lo ignorado no entra a ningún lado y se puede deshacer. Leer `~/.claude` del cliente es una decisión de
Martín: hoy la regla de `mako-pc` es no tocarlo.

**Vive en:** `scripts/ia-pc/mako-pc.mjs` (la cabecera: «no toca ~/.claude») · `lib/centro-turnos-db.ts`

## Un «no puedo» de MaKo casi nunca es «no existe»: los 10 de Leila en dos días (27/10/2026, Cerebro)

**Vive en:** `lib/mako-intencion.ts` · `lib/doer-herramientas.ts` · `lib/mako-analyst-lead.ts` · `lib/editor-video/chat-catalogo.ts`

- **El síntoma:** Leila (ws11) pide editar algo y MaKo le dice que no puede, cuando sí se podía. Martín (27/10, 20:37):
  «siempre que MaKo responda algo como "No lo pude hacer" debe levantar automáticamente un ticket».
- ⚠️ **Ninguno de los 10 era algo que no existe.** Las causas, medidas con los datos de producción:
  - **El catálogo del chat no tiene lo que la pantalla sí:** «¿Puedes eliminar los silencios?» → «No puedo», con el botón
    «Borrar silencios» ahí desde el 14/10. El prompt dice «SOLO PUEDES USAR ESTAS OPERACIONES» y la op no está.
  - **La regla 9-bis del clasificador:** un mensaje que arranca con «No…» y tiene ≤60 caracteres da `charlar` y 0
    herramientas («No me deja editar sus cuotas», «No puedo cambiar la fecha de la cuota 2»). La regex `CONFIRMACION`
    NO es la que se arregla: la usan `corrigeAgenda` y la regla 1 (hallazgos-comunicacion, «no, movela al viernes»).
  - **El modo «Editar» de la ficha se adueña del pedido:** `PISTA_EDICION_FICHA` lo vuelve «diseño» y no viajan
    `editar_cuota`, `editar_venta_lead` ni `guardar_cuotas`; además la pantalla traba los montos en ese modo.
  - **Las cuotas exigen la palabra «cuota»:** «fechas y cantidades de pago» o «quincena» no suman el área cobros, y el
    presupuesto de 12000 deja afuera `guardar_cuotas`. Así nació el ticket #13, un «no existe» falso.
  - **La IA del cliente sin crédito:** todo cae a gpt-4o-mini, que promete («Voy a…») sin mandar la op.
- **La regla:** antes de declarar «no existe» (y de que un ticket automático lo diga), mirar el clasificador y el
  catálogo de esa superficie. El ticket automático lleva su `causa` (no-existe, ruteo, herramienta, ejecución, texto), y
  el título nunca es el texto del modelo.
- **Quién:** MaKo inteligente (el ruteo y la base del ticket, sobre la rama c4), MaKo en WhatsApp y Motion. Diagnóstico:
  workflow `wf_80b91164-275` del Cerebro.

**La revisión del 28/10/2026 de los «no puedo» falsos (claude4):**
- **En México «quincena» es de todos los días** («la segunda quincena», «las ventas de la quincena son 12»): sólo cuenta como
  frecuencia de PAGO («cada quincena», «quincenal»), la mensualidad sólo si es de alguien («de Ana», «su»; en la ficha del lead,
  `delLead`), una pregunta sin verbo de cambiar no es un pedido, y la agenda le gana al plan. Medir con frases de la clienta, no
  sólo con las del ticket: la señal ancha recreaba el «no puedo» falso en la agenda.
- **Lo que se ofrece no lleva destructivas** (reembolsar, dar de baja, despublicar) y en modo «analizar» no se ofrece nada: con el
  «sí» lo que escribe no viaja. Un ofrecible es una promesa: tiene que pasar las mismas puertas que la herramienta.
- **«Anotado» sin sujeto, sí; un estado LEÍDO, no** («La cuota 13 quedó registrada como cobrada» es un dato de cobranza_lead). La
  regla de precisión de lib/doer-salida.ts ya lo decía: un estado puede ser lo que MaKo leyó.

**La verificación del 28/10/2026 (claude4):** angostar la señal del plan se pasó de largo con frases vecinas. Un «están mal,
¿me ayudas?» es un pedido (la pregunta del final no lo anula si dice que algo está mal); la llamada o la cita como CONTEXTO no le
gana al plan (sólo un pedido de MOVERLA: `MUEVE_AGENDA`); y el estilo de la vista («mostrar», «formato», «más grande») vale sólo en
«Editar» (`nombraLaVistaDeLaFicha`), no en todo esPedidoDeCobro, donde «me mostró» o «la orden de compra» son datos. «Anotado, …»,
«Anotado 👍» y «Anotado y guardado» siguen siendo un «Anotado»; con una pendiente, la queja suelta («No anda») tampoco es un «no».

**Los tickets #46, #47 y #48 de Leila (3/11/2026, claude2): la palabra de la persona no era la del NOMBRE de la herramienta.**
- **El síntoma:** «quiero pasar el precio a dólares» → «el precio no lo puedo cambiar desde este chat»; «el WhatsApp del
  diagnóstico tiene que disparar una secuencia» → «sólo puedo activar o pausar»; «¿dónde actualizo mis datos?» → «la ruta no la
  tengo confirmada». Las tres cosas existían: `guardar_oferta`/`guardar_producto` (proponen el precio con link),
  `crear_automatizacion_con_ia` (crea la secuencia con disparador por etiqueta) y el Second Brain («La oferta» → «El brief»).
- ⚠️ **El diagnóstico obvio era el equivocado: la lista `noViajaron` del ticket NO nombraba las herramientas que faltaron.** Se
  lee como «lo demás viajó y el modelo eligió negar». No: `parecidasQueNoViajaron` trae sólo las 6 de más puntaje, y
  `guardar_oferta` (1 punto, por «precio» en la descripción) quedaba fuera del top. **Se mide con el turno real**
  (`clasificarIntencion` + `herramientasDelChat`, canal app, como `herramientas()` en tests/mako-no-puedo-falsos.test.ts): en los
  tres pedidos no viajaba NINGUNA de las que resolvían.
- **La causa:** el presupuesto de 12.000 ordena por palabras en común con el id y el título. «precio», «secuencia», «disparar»,
  «datos» y «dónde» no estaban en esos nombres («oferta», «automatización», «Qué se hace dentro de MaKo»), y ninguna familia de
  `lib/mako-intencion-app.ts` las sumaba. Además «oferta» abría sólo el área `crm`, y `guardar_oferta` es de `negocio`.
- **Y un cuarto, del mismo tipo:** `guardar_campo_perfil` y `guardar_oferta` mandaban a corregir el precio a «Documentos», cuando el
  campo se LEE y se corrige tocándolo en «La oferta» → «El brief» (CamposNegocio escribe en el mismo `archivero/manual`).
- **La regla (la del #45, ahora con dónde vive):** lo que un chat dice de una pantalla sale de UNA tabla con el nombre que la persona
  lee: `DATOS_DEL_NEGOCIO` + `lugarDato`/`rutaDato` (lib/secciones-negocio.ts), y el test 17 busca cada nombre en `AREAS` y en las
  pestañas de AreasHub. Cuando un pedido real no trae su herramienta, la familia nueva lleva su frase literal en un test.
- **Lo que quedó SIN hacer:** `guardar_campo_perfil` sigue completando sólo huecos: MaKo no puede corregir un precio ya cargado en
  «El brief», sólo decir dónde se toca (lib/api-mako/areas/negocio.run.ts, `guardar_campo_perfil`; abrirlo es una decisión de
  producto). Un «pásalo a dólares» suelto, sin la palabra «precio», todavía no trae `guardar_oferta`.

## El grupo de WhatsApp usaba el prompt del DASHBOARD (28/10/2026, claude4, el diagnóstico del Cerebro, F1)

**El síntoma:** «Mira… no es arrancar por los flujos locos, sino por definir el disparador… armamos el experimento para
validarlo» (Leandro), «el problema no es que falte interés, sino…» (Brigitte), «Te voy a ser directo» dos veces en 6 minutos
(Sergio), y «¡Buen día, Martín!» a Joan, en un grupo donde nunca escribió nadie llamado Martín.

**La causa:** el turno del grupo armaba su system con `buildSystemPrompt` como el chat general del dashboard: la persona
«consultor IA de Martín Koncke» (lib/mako-persona.ts, escrita para el negocio de Martín), MAKO_NUCLEO («NUNCA termines con una
pregunta», «CIERRA PROPONIENDO INICIAR UN EXPERIMENTO»), «CONTEXTO: chat general del dashboard», la fase de la sección y 4
fragmentos de metodología de copy, todo ANTES de DOER_WA_VOZ, que pedía lo contrario. Fue la causa más frecuente: 15 de 49.
⚠️ **Cambiar a Claude no lo arreglaba:** el system es el mismo para cualquier modelo. Y el «Martín» sale de la persona, no de
que falte el autor en la memoria.

**La regla (lib/nucleo-grupo.ts, lib/mako-context.ts con `canal: 'grupo'`):**
- NUCLEO_GRUPO va primero y FIJO en código, como REGLA_NO_DESCALIFICAR: ningún override de Configuraciones lo saca (medido el
  28/10, sólo lectura: ningún negocio tiene `mako.prompt-overrides` ni `mako.prompts`; sólo ws1 y ws4, `mako.fase.general`);
- sin la persona, sin MAKO_NUCLEO, sin «chat general del dashboard» y sin la fase de la sección; también en la red (lean);
- el contexto del NEGOCIO (fase, objetivos, metodología, experimentos, funnel, cara de marca, tabs sin configurar) sólo si el
  turno piensa o consulta sus números, su copy o sus anuncios (`conElNegocio`);
- lo que no entiende se pregunta (DOER_WA_VOZ ya no dice «¿te lo anoto como tarea?»); un link sólo si lleva a lo concreto (nada
  de /plan ni /dashboard de relleno), y /automations entre los links; `**x**` y `##` salen como `*x*` (`aFormatoWhatsapp`).
- La app y los gráficos siguen con la persona y el núcleo de siempre (lib/mako-turno-app.ts): no se tocó MAKO_NUCLEO.
- ⚠️ NUCLEO_GRUPO no nombra la marca `[[ya-pedido]]`: todavía no existe, y el modelo la escribiría y le llegaría al cliente.
  Entra con F2b (los tickets del negocio en el system).

## El detector de voseo de la IA era una lista de 21 palabras, y el bueno vivía adentro de un test (29/10/2026, Copywriter)

- **Síntoma:** al romper a propósito un botón del Copywriter con «Escribime por mensaje», el test de voseo siguió verde.
  «Agendá», «mandame» y «decime» también pasaban como neutros.
- **El diagnóstico obvio era el equivocado.** Parecía que faltaban palabras en la lista de `marcasDeVoseo`
  (lib/puestas-data.ts), pero un generador completo ya existía: el del guard del repo (tests/puente-panel-copy.test.ts).
  Conjuga desde ~200 verbos (presente, imperativo, clíticos, la grafía sin tilde) y su lista de neutros descarta sola lo
  que también es de tú. Como vivía en un test, la IA no lo podía usar. Eran dos detectores de lo mismo: el del repo veía
  «escribime» en una pantalla, y el de la IA lo dejaba pasar en lo que escribía para un cliente.
- **Una regla sólo por terminación no sirve, y no por falta de ganas:**
  - el imperativo de vos de un -ir («elegí», «viví», «escribí») es igual al pretérito de 1.ª persona;
  - «-rás» es el futuro de tú («verás», «tendrás»);
  - «-és» trae gentilicios («inglés») y «después»;
  - «-ar + te» cae encima del inglés («create», «validate»).

  El generador parte de los verbos y deja escritas, con su porqué, las excepciones (`HOMOGRAFOS`).
- **La regla que queda:** un detector que usan un test y el código de producción vive en `lib/` y el test lo importa.
  `lib/voseo.ts` es la única fuente; `marcasDeVoseo` y el guard la comparten. Sumar un verbo trae sus ~30 formas a las dos
  puntas.
- **En lo que escribe la IA aparecen homógrafos que el copy del repo no tenía:** «Tomás» (un nombre) y «mandala».
  Quedaron en `HOMOGRAFOS`.
- **Sin hacer:** el alcance es la lista de verbos. Un verbo que no está (por ejemplo «chequear») no se ve conjugado. Se
  suma en `REGULARES` o `IRREGULARES` de lib/voseo.ts.
- ⚠️ **Mudar el léxico a `lib/` lo pone bajo el guard que lo usa** (tren-ag, Integración, 30/10). `lib/voseo.ts` nombra
  `vos`, `acá` y `laburo` para BUSCARLOS, y `tests/puente-panel-copy.test.ts` lo frenó como copy. En el árbol del chat pasó
  porque el guard lista con `git ls-files` y el archivo nuevo todavía no estaba en el índice. Ahora está en la lista de los que
  pueden nombrar el voseo (`512f49af5`). **Regla:** un archivo nuevo que el guard tiene que ver se commitea ANTES de correr
  el guard.

## El clasificador del grupo va con Haiku, sin razonamiento en la salida y sin forzar la herramienta (29/10/2026, claude3)

**Vive en:** `lib/mako-intencion-ia.ts` (`SYSTEM_DE_CLASE`, `leerClase`) · `lib/mako-doer-in.ts` (`clasificadorDelGrupo`) ·
`lib/veto-claude.ts` (`evaluarClaveDelNegocio`)

- **Qué modelo corre:** primero el Claude del negocio, si tiene (`soloSuClaude`); si no, el crédito de los grupos
  (`cuentaDeLosGrupos`), y el veto le da Haiku 4.5 (`modelos[0]`). Martín, 29/10: «Sigue Haiku. No toques el veto». Lo que se
  mide en el banco es Haiku.
- ⚠️ **Sin un campo de razonamiento en la salida.** En la familia 5.x, pedir `reasoning` o `<thinking>` en el texto puede volver
  como `stop_reason: refusal` con HTTP 200 (categoría `reasoning_extraction`): parece un éxito y no trae clase. El esquema es
  `{clase, resumen, reenviado, secundaria, negocio}` y el porqué lo arma el código.
- ⚠️ **Nada de `tool_choice: any`/`tool` para forzar el JSON:** da 400 en Opus 5.5, Sonnet 5.5 y Fable 5.1 (y el prefill, en toda la
  familia 4.6+). La salida se lee buscando el primer objeto JSON; lo que no se puede leer es null, nunca una clase por default, y
  mandan las reglas.
- **Gasto medido en el banco (29/10, 66 llamadas):** ~2.000 tokens de entrada y ~67 de salida por mensaje = US$0,0023 por mensaje
  clasificado. Con lo que llega hoy a los grupos (49 turnos en 6,9 días, ~7 por día) son ~US$0,02 por día; a 100 mensajes por día,
  ~US$0,23. El turno que contesta una PREGUNTA o una ACCIÓN es aparte (el de siempre).
- **Dato para decidir, no se cambió:** Haiku 5.5 (`claude-haiku-5-5`) cuesta US$0,10 / US$0,50 por millón de tokens, diez veces menos
  que Haiku 4.5 (US## El detector de voseo de la IA era una lista de 21 palabras, y el bueno vivía adentro de un test (29/10/2026, Copywriter)

- **Síntoma:** al romper a propósito un botón del Copywriter con «Escribime por mensaje», el test de voseo siguió verde.
  «Agendá», «mandame» y «decime» también pasaban como neutros.
- **El diagnóstico obvio era el equivocado.** Parecía que faltaban palabras en la lista de `marcasDeVoseo`
  (lib/puestas-data.ts), pero un generador completo ya existía: el del guard del repo (tests/puente-panel-copy.test.ts).
  Conjuga desde ~200 verbos (presente, imperativo, clíticos, la grafía sin tilde) y su lista de neutros descarta sola lo
  que también es de tú. Como vivía en un test, la IA no lo podía usar. Eran dos detectores de lo mismo: el del repo veía
  «escribime» en una pantalla, y el de la IA lo dejaba pasar en lo que escribía para un cliente.
- **Una regla sólo por terminación no sirve, y no por falta de ganas:**
  - el imperativo de vos de un -ir («elegí», «viví», «escribí») es igual al pretérito de 1.ª persona;
  - «-rás» es el futuro de tú («verás», «tendrás»);
  - «-és» trae gentilicios («inglés») y «después»;
  - «-ar + te» cae encima del inglés («create», «validate»).

  El generador parte de los verbos y deja escritas, con su porqué, las excepciones (`HOMOGRAFOS`).
- **La regla que queda:** un detector que usan un test y el código de producción vive en `lib/` y el test lo importa.
  `lib/voseo.ts` es la única fuente; `marcasDeVoseo` y el guard la comparten. Sumar un verbo trae sus ~30 formas a las dos
  puntas.
- **En lo que escribe la IA aparecen homógrafos que el copy del repo no tenía:** «Tomás» (un nombre) y «mandala».
  Quedaron en `HOMOGRAFOS`.
- **Sin hacer:** el alcance es la lista de verbos. Un verbo que no está (por ejemplo «chequear») no se ve conjugado. Se
  suma en `REGULARES` o `IRREGULARES` de lib/voseo.ts.
- ⚠️ **Mudar el léxico a `lib/` lo pone bajo el guard que lo usa** (tren-ag, Integración, 30/10). `lib/voseo.ts` nombra
  `vos`, `acá` y `laburo` para BUSCARLOS, y `tests/puente-panel-copy.test.ts` lo frenó como copy. En el árbol del chat pasó
  porque el guard lista con `git ls-files` y el archivo nuevo todavía no estaba en el índice. Ahora está en la lista de los que
  pueden nombrar el voseo (`512f49af5`). **Regla:** un archivo nuevo que el guard tiene que ver se commitea ANTES de correr
  el guard.
 / US$5), pero viene con el razonamiento adaptativo prendido (habría que medirlo en el banco antes). Cambiarlo
  es tocar el veto: es de Martín.

---

## El catálogo prometía «nunca con Gemini» y la VISIÓN no lo miraba (6/11/2026, `punta/marca-sin-gemini`)

**Vive en:** `lib/ai-cheap.ts` (`DocOpts.sinGemini`, `leerDocumentoIA`) · `lib/archivo-a-texto.ts` (`OpcionesLectura.sinGemini`) ·
`lib/marca/leer-manual.ts` · `lib/model-catalogo.ts` (`marca-leer`, `deSuIA: true`)

**El síntoma: una promesa escrita que el código no cumplía.** `model-catalogo.ts` declara la feature `marca-leer` con
`deSuIA: true`, `fallback: []` y la nota, textual, «Corre con la IA del negocio (su Claude o su GPT), **nunca con Gemini**»
—la decisión de Martín del 22/10 para Image—. El camino de TEXTO lo cumplía: `chatClaude` lee el catálogo y pasa `sinGemini`,
que filtra `gemini` de la cascada. El camino de **VISIÓN** no: `leerDocumentoIA` recorre `VISION_CASCADE`
(`['gemini', 'openai']`) y **no tenía la opción**, así que leer la IMAGEN de un brand board seguía usando el Gemini del
negocio cuando era lo único que tenía. Era la última excepción de Image, declarada como inconsistencia D6b y nunca cerrada.

**La causa de fondo, que es la parte reutilizable:** `sinGemini` se implementó donde se necesitaba —la cascada de texto— y
no como una propiedad de «pedirle algo a una IA». Quedó una función (`chatCheapCascade`) que la respeta y otra
(`leerDocumentoIA`) que no, con el mismo catálogo detrás. **Una decisión sobre QUÉ IA puede correr una feature tiene que
valer en TODOS los caminos que llaman a una IA, o la promesa del catálogo es decorativa.** Y lo que se lee es el catálogo:
la nota del `marca-leer` es lo que un chat futuro va a citar como verdad.

⚠️ **Y la puerta tenía un segundo lado, que es el que no se ve.** Un manual de marca **escaneado** no entra por el camino de
visión directo: entra por `archivoATexto`, que llama a `leerDocumentoIA` dos veces (PDF e imagen) por su cuenta. Arreglar
sólo el primero dejaba la misma fuga para el PDF escaneado, que es el caso más probable de un manual de marca de verdad.
`sinGemini` va enhebrado por los dos. Es «enumerá los caminos que no pasan por ahí» de AGENTS.md: un `grep` de
`leerDocumentoIA` los lista en un segundo, y sin ese grep el arreglo queda a medias y se lee como completo.

Y la red gratis de la plataforma (que es Gemini) se filtra con la misma lista: una feature «de su IA» que cae en la cuenta
gratis de MaKo es exactamente lo contrario de su IA.

⚠️ **Y DOS GUARDAS LEEN ESTE FUENTE PALABRA POR PALABRA: el orden de las propiedades de la llamada es parte del
contrato.** Las dos dieron rojo en Actions con el arreglo puesto, y ninguna es un test del comportamiento:

- `tests/onboarding-red-plataforma.test.ts` exige, con un `assert.match` sobre el fuente, que la red de plataforma filtre
  con el texto literal **`VISION_CASCADE.includes(x.provider)`** («la red sólo prueba los que MIRAN: trae gemini y groq, y
  groq no tiene visión»). Reemplazarlo por la lista ya filtrada —que es lo natural— lo rompe. La salida es **sumar** la
  condición al lado (`&& (!opts.sinGemini || x.provider !== 'gemini')`) en vez de reemplazar el término: son dos preguntas
  distintas y el guard pregunta por la primera.
- `tests/adjuntos-chats-de-texto.test.ts` cuenta **exactamente dos** apariciones de
  `redDePlataforma: opts.redDePlataforma, timeoutMs: opts.timeoutMs })` en `lib/archivo-a-texto.ts` («el plazo no llega a la
  visión»). Agregar la propiedad nueva DESPUÉS de `timeoutMs` deja la cuenta en cero. Va **antes**.

**La regla:** cuando un guard afirma algo leyendo el fuente, su assert es una API tan real como la firma de la función — y
no aparece en ningún `import`, así que `tsc` no la ve y el editor no la autocompleta. Antes de reordenar o reescribir una
llamada en un archivo caliente (`ai-cheap.ts`, `archivo-a-texto.ts`), un `grep` del nombre del archivo en `tests/` dice
quién lo está mirando. Son dos segundos, y el rojo cuesta un run de Actions de diez minutos.

**Lo que cambia para un negocio que sólo tiene Gemini:** su manual de marca ya no se lee, y se le dice
(`errorDeCascada` / «conecta tu IA»). No es una regresión encubierta: es lo que `fallback: []` del catálogo ya decidía, y
antes el código lo desobedecía en silencio.

## La red gratis de la plataforma no corre para NADIE: dos guardas que se excluyen (6/11/2026, `punta/chat-avisos-ia-imposibles`)

Buscando sacar cuatro avisos del lienzo que decían «La IA gratis de MaKo llegó a su tope de hoy», el pendiente daba por
motivo «con IA16 la red no corre FUERA del ws9». **Medido, el motivo es más fuerte: tampoco corre ADENTRO.** Son dos
guardas, en dos archivos distintos, que no pueden ser verdad a la vez:

1. `provsGratisDePlataforma()` (lib/ai-cheap.ts) devuelve `[]` salvo que el workspace en curso SEA el del super admin:
   `if ((await getWorkspaceActual()...) !== ws) return [];` — la decisión de Martín del 22/10/2026 («Cada usuario debe
   poder pagar su token»: las keys de la plataforma son sólo para lo interno de MaKo).
2. Y **sus cuatro llamadores** están detrás de la condición CONTRARIA, `wsActual !== wsSA`: sólo corren cuando el
   workspace en curso **no** es el del super admin («el super admin ya probó SUS keys arriba: repetirlas es gastar
   tiempo en lo que ya falló»), y eso también es correcto por separado. Son `chatCheapCascade` (:1017), el contador
   `hayRed` (:817, que ya lo dice en su comentario: «Hoy da false siempre»), el lector de documentos (:1224) y
   `transcribirAudio` (:2132).

⚠️ **Y «el único llamador» es justo el error que cometimos al escribir esto**: la primera versión del test afirmaba que
había uno, y la rotura mostró cuatro. Contar los llamadores de una función exportada se lee como un dato obvio y no lo
es: el grep del nombre encuentra también la declaración y la llamada recursiva, y la guarda del cuarto no está en un
`if` que lo encierre sino en la MISMA expresión.

Las dos juntas dejan `red` siempre vacía: el `for` sobre los proveedores gratis nunca itera y el
`erroresPlataformaOut?.push()` del error de la red es **código muerto**, en los cuatro. Ninguna de las dos guardas está mal:
lo que quedó mal es el **efecto combinado**, que ningún archivo nombra porque cada una tiene su porqué escrito en su
propio lugar.

**La regla que queda: una guarda correcta más una guarda correcta puede ser una función apagada.** Cuando dos archivos
deciden por separado «sólo acá» y «sólo allá» sobre el MISMO camino, hay que medir la intersección — y la intersección
no se lee en ninguno de los dos comentarios. Acá el síntoma era al revés de lo esperado: el pendiente decía «esta rama
ya no puede pasar para un cliente» y la verdad era «esta rama no puede pasar para nadie, y además hay 30 líneas de
cascada que no corren».

**Lo que SÍ puede llegar todavía en `erroresPlataformaOut`** (y por eso el aviso no se puede simplificar más allá de
esto): un fallo del **crédito** de Claude de la plataforma, que es otra cosa que la red gratis y sí alcanza a un cliente
— pero sólo para las features de `CREDITO_HABILITADO_PARA` (lib/veto-claude.ts), que son las del wizard de onboarding y
las del editor de landings. `chatbot-crear-ia`, el único llamador que le pasa `red` a `falloDeIA`, no está en esa lista.
`tests/ia-aviso-sin-ia-propia.test.ts` lo fija: si entra, el test pide que el aviso lo diga con sus palabras.

**Sin hacer:** decidir si la rama de la red gratis de `chatCheapCascade` se borra o se arregla. Hoy es código que se lee
como vivo (tiene su `TECHO_ENTRADA`, su orden `otroPrimero` y su registro de uso) y no corre nunca. Borrarla o
habilitarla es decisión de Martín: habilitarla es volver a prestarle IA a un cliente, que es justo lo que decidió que no.

**Vive en:** lib/ai-cheap.ts (`provsGratisDePlataforma` y su llamador en `chatCheapCascade`) · lib/veto-claude.ts
(`CREDITO_HABILITADO_PARA`) · lib/flujo-ia.ts (`sinIAPropia`) · tests/ia-aviso-sin-ia-propia.test.ts

## Dos claves de Gemini muertas, cargadas en varios negocios a la vez (11/11/2026)

- **Síntoma:** el Copywriter del negocio de MaKo devolvió 502 a los ~110 s, con «La API key parece inválida o vencida. Pega una
  nueva. (copywriter-ia: gemini no contestó antes del plazo (gemini: chatCheap(gemini): API key not valid…)». Quince minutos
  antes había andado.
- **Medido** (GET `models` de Gemini, que no genera ni cobra; script de sólo lectura que descifra cada `GEMINI_API_KEY*` con
  `lib/cripto-credenciales.ts` y no la imprime): de 22 claves, 4 filas dan 401 «API key not valid», pero son sólo DOS claves:
  la base del ws 9 (también cargada como base del ws 10) y la `_4` del ws 9 (también cargada como base del ws 1). Las otras
  18 contestan 200. En el ws 9, la `_2` y la `_3` están vivas.
- **El diagnóstico obvio puede ser el equivocado:** un 401 vuelve en el acto, así que una clave muerta sola no explica 110 s.
  Con dos cuentas vivas, el plazo se gastó en otra parte (las vivas lentas, sin cupo, o reintentos), y el mensaje mostró el
  PRIMER error, el de la clave muerta. Falta medirlo antes de culpar a la clave.
- **Regla:** una misma clave copiada en varios negocios muere en todos a la vez; al reemplazarla, se reemplaza en todos. Y el
  error que ve el usuario no puede ser el texto técnico ni pedirle a la plataforma que «pegue una nueva».
- **Sin hacer:** que la cascada salte y recuerde una cuenta muerta (`lib/ai-cheap.ts`), y el mensaje de `errorDeCascada`
  (`lib/ia-mensajes.ts`).
- **14/11/2026: siguen muertas.** El desarme de videos (ticket 97, `lib/video-desarmar-gemini.ts`) vio la cuenta 1 y la 4 del
  ws 9 con 401 en cada pedido. Nadie las reemplazó en tres días.

## La cuota gratis de Gemini es POR MODELO: un 429 no es «otra cuenta» (14/11/2026, ticket 97)

- **Síntoma:** el desarme de un reel en el ws 9 falló a los 23 s con «Quota exceeded… limit: 20, model: gemini-3.8-flash».
  Quedaban dos cuentas vivas, y `gemini-flash-lite-latest` no se probó en ninguna.
- **Causa:** el plan gratis de AI Studio topea los pedidos por día por PROYECTO y por MODELO
  (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`). Un 429 del modelo principal no dice nada del de respaldo, que tiene
  su propia cuota. El código lo trataba como un error duro («otra cuenta») y saltaba de cuenta, donde volvía a pedir el modelo
  principal sin cuota.
- **Regla:** ante un 429, el modelo de respaldo en la MISMA cuenta antes que la cuenta siguiente. Lo hace
  `lib/video-desarmar-gemini.ts`; con eso, el mismo reel salió con la cuenta 3 y flash-lite.
- **Sin hacer:** `guionDeYoutubeConGemini` (`lib/ai-cheap.ts`, el guion de YouTube de Spy) hace lo de antes. Su comentario
  dice que un error que no es saturación «no cambia con otro modelo: otra cuenta»; un 429 de cuota sí cambia con otro modelo.

## El crédito de Claude PRIMERO en el espacio de MaKo y en WhatsApp, Gemini de respaldo (11/11/2026)

- **La decisión**, Martín, textual: «MaKo con WhatsApp ya habíamos dicho que eso se gaste con los tokens de las cuentas de
  Claude 200 dólares que estoy pagando… En general, yo creo que sería bueno que gastemos eso para todo esto en lugar de Gemini,
  porque es mucho más estable.» Lo que NO cambia: un negocio fuera de WhatsApp sigue con SU IA; el Plan queda afuera («JAMÁS
  algo pago para el plan»); las funciones con `fallback: []` no usan el crédito; y en el grupo de un cliente sin IA propia, si
  fallan las cuentas, queda el cartel (nunca el Gemini de la plataforma con datos de sus clientes). La regla para código nuevo
  está en AGENTS.md (la tercera puerta del veto).
- **El diagnóstico obvio era el equivocado: la puerta 3 parece la del crédito, y la que sirve es la 2.** `conCreditoDeLaPlataforma`
  lee 2 de las 5 cuentas (y la 1 es la asignada a Mauricio), no acepta imágenes ni herramientas, y su test corta el cuerpo a
  8.000 caracteres. La puerta 2 (la de los grupos de WhatsApp) ya tenía la lista única de cuentas, el reparto, la cuenta
  agotada salteada, el interruptor, Haiku forzado, el Plan afuera y la marca «(cuenta N)». El cambio fue una regla (quién
  puede usar una cuenta) y tres lugares que la consultan.
- **WhatsApp ya corría con el crédito desde el 28/10; lo que mentía era el catálogo.** En la semana del 4 al 11/11, las 94
  llamadas de `mako-doer-in` fueron Haiku con crédito, y el catálogo decía `def: GEMINI()`: figuraba entre «las 60 con Gemini».
- **El override `mako.modelos` es global** (se guarda en OWNER_WS): no sirve para rutear sólo el ws 9. Y poner un `def` de
  Anthropic manda la llamada a la puerta 1, que el veto frena. No se toca ni el `def` ni /modelos-ia.
- **Trampas que estaban vivas:**
  - el chat de WhatsApp SIN pin y sin IA propia caía a la puerta 1 con Sonnet u Opus, y el veto lo cortaba (hoy no pasaba
    porque hay un pin; sacarlo en /modelos-ia lo rompía);
  - el `fetch` del bucle con herramientas (`chatClaudeTools`) no tenía timeout, y el clasificador del grupo tampoco: un
    Anthropic colgado trababa el turno hasta el corte de undici (~300 s);
  - el agotamiento de una cuenta de los grupos no quedaba escrito: se marcaba sólo en la memoria de la instancia, sin la fila
    «sin crédito hasta el próximo ciclo», así que el Uso (`sinCreditoAt`) nunca se enteraba; y el gasto de un negocio sin su
    Claude quedaba anotado en el ws 9;
  - `conClaveDelNegocio` anotaba un fallo de NUESTRO crédito en la tarjeta de «Tus cuentas de IA» del negocio.
- **Costo, medido del 4/11 al 11/11** (Haiku a 1/5 US$ por millón): el ws 9 sin el Plan, unos US$28 por mes; WhatsApp fuera del
  ws 9, US$1,4. Unos US$30 de los US$400 de las dos cuentas con clave. El pico del 9/11 todos los días serían US$163. Lo que
  mide MaKo es lo REGISTRADO: Anthropic no deja leer el saldo, así que si las claves se usan fuera de MaKo el número se queda corto.
- **Dónde quedó la regla:** `puedeUsarUnaCuentaDelCredito` (lib/veto-claude.ts, pura) y `esElEspacioDeLaPlataforma`
  (lib/anthropic.ts, el workspace en curso contra `wsSuperAdmin()`). La consultan la puerta 2, la cascada de texto, el bucle con
  herramientas y la lectura de imágenes. El reparto y el 90% viven en lib/credito-negocio.ts (`cuentasDelCredito`), y el vigía
  del 80/100% en lib/credito-vigia.ts (desde /api/cron/alerta-critica).
- **Tres capas frenan al Plan, y eso confunde al probar rompiendo:** sacar el Plan de la regla nueva deja VERDE la prueba de
  verdad (ia-saturacion), porque `planPuedePagarConSuClave` y `evaluarClaveDelNegocio` lo vuelven a frenar. La regla sola la
  caza el test puro (tests/credito-plataforma.test.ts). Un verde después de romper una capa no prueba que la capa sobra.
- **Un test que fija el orden exacto del reparto depende de cuántas llamadas hubo antes en el mismo proceso** (el contador es
  de `globalThis`). Sumar un caso arriba en el hijo rompió tests/credito-grupos.test.ts 5 sin que el reparto cambiara: se compara
  el conjunto de rotaciones, no cuál va primero.
- **El plan asumía una pantalla /modelos-ia que ya no existe** (se fue el 25/10, app/admin/dev/areas.ts). Lo que corre primero
  quedó en su API (`primero`, lib/model-registry.ts → `getModelosConfig`), con la misma regla que la puerta.
- **Sin hacer:**
  - el techo de entrada de Haiku quedó en 150.000 tokens a la cuenta de la cascada (3,5 caracteres por token), con 200K de
    contexto: **a verificar** con `count_tokens` sobre un pedido grande real (`TECHO_ENTRADA.anthropic`, lib/ai-cheap.ts);
  - ninguna cuenta tiene `diaDeCobro` (lib/credito-api.ts → `CUENTAS_DEL_CREDITO`): el vigía mide el mes calendario hasta que
    Martín cargue el día de cobro de cada plan;
  - el tope por negocio del crédito (M2, docs/hallazgos-comunicacion.md) sigue pendiente; ahora el gasto queda en el ws de cada
    negocio, así que se puede medir antes de fijarlo;
  - el paso 9 del plan, «sólo si no alcanza»: el relevo por función, cachear el system y las herramientas del bucle
    (`chatClaudeTools`, unos 18k de entrada por llamada de `mako-doer`) y evaluar otros proveedores;
  - la marca en memoria de la cuenta agotada que todavía hacen el doer y el bot (lib/mako-doer-in.ts, lib/mako-bot.ts) quedó
    redundante (la hace la puerta): no molesta, y la fija tests/doer-su-ia.test.ts;
  - fuera de este cambio y con fecha: el permiso de `closing` vence el 13/11 (lib/veto-claude.ts) y el precio de Sonnet 5 sigue
    a 2/10 (lib/anthropic-usage.ts).

## La revisión del crédito primero: cuatro fugas, y el arnés que las escondía (11/11/2026, claude4)

- **`?? 0` convertía «no sé» en «0%», y abría la reserva de WhatsApp justo sin dato.** Con el gasto ilegible, el vigía guardaba
  `{}` con la hora de ahora (pisaba el 95% de una cuenta) y `ordenDeLasCuentas` leía `uso[c] ?? 0`: la plataforma volvía a usar
  esa cuenta. Ahora un % incompleto no se guarda (`avisosDelCredito` → `completo`) y para la plataforma faltar es quedar fuera
  (lib/credito-api.ts, lib/credito-vigia.ts).
- **«Su clave gana» en la puerta 2 hace que reintentar con una cuenta del crédito sea reintentar con SU clave.** La foto de un
  grupo (`leerDocumentoIA`) entraba al lazo con cualquier fallo, también el de su Claude sin saldo: N pedidos a su clave y N
  filas en su tarjeta, y el crédito nunca. El doer ya lo evitaba (`sin_su_claude`); la foto no. Ahora, sólo con el primer intento
  en `null` (lib/ai-cheap.ts).
- **«Al respaldo» suponía que había uno.** Para un negocio sin su IA, un 529 del crédito era el cartel de fallo en el turno y la
  foto sin leer: no hay Gemini ni red. Ahora, sin respaldo, lo pasajero prueba UNA cuenta más (lib/veto-claude.ts,
  lib/mako-doer-in.ts, lib/ai-cheap.ts). La foto no repite un cuelgue (90 s por pedido).
- **El diagnóstico obvio era el equivocado: el test de saturación estaba verde PORQUE el arnés corta todo a 50 ms.**
  tests/_ia-saturacion-hijo.ts recorta `AbortSignal.timeout` y anotaba el plazo pedido a Google, no el del crédito: el crédito
  pedía TODO lo que quedaba del `hastaMs`, y en producción un Haiku colgado dejaba a Gemini en «sin tiempo» sin un pedido.
  Con un arnés que acorta el tiempo, lo que se afirma es el plazo PEDIDO, nunca «el respaldo corrió». Ahora el crédito pide
  lo que queda menos `MIN_INTENTO_MS`, y con menos de 30 s no va.
- **Sin hacer:** «hay respaldo» en el turno del grupo no mira `turnoRed.cortar` (la red del ws9 salteada por datos de clientes
  cuenta como respaldo, y entonces no se reintenta: lo de antes, lib/mako-doer-in.ts → `hayRespaldoDespuesDeClaude`); y el
  clasificador del grupo sigue cortando al primer 529 (ahí mandan las reglas, no hay cartel).
