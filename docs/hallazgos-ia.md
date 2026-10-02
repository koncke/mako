# Hallazgos de MaKo (IA)

Lo que hay que saber antes de tocar los prompts (`lib/mako-prompts.ts`,
`lib/prompt-registry.ts`), el ruteo de modelos (`lib/model-registry.ts`), la cascada barata
(`lib/ai-cheap.ts`) o el doer (`lib/mako-doer-*.ts`). **No es un changelog.**

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

**Sin hacer:** `recomendarFormatos()` (lib/angulos-formatos.ts:99) no acepta `timeoutMs` y
corre con el default de 30 s por intento. Agregarlo es tocar la firma de una lib compartida; la
API la corre con una carrera de 45 s, que es segura solo porque esa función no escribe.

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

### ⚠️ Los prompts de la matriz de razones y de los ángulos nunca se registraron

`razones.system`, `razones.user`, `razones.guion`, `formatos.system` y `formatos.user` se
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
(martinkoncke@gmail.com, tejadomartin@gmail.com, elevate.com.mx) y no son configurables por
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

### Pendiente, y bloquea pedir la verificación a Google

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
- **`contarKeysIA` puede devolver 40.** `clavesCargadas` degrada a «no sé» devolviendo el
  catálogo entero, y eso pasa también cuando el workspace tiene CERO filas en
  `credenciales`. Con eso el veredicto `sin_keys` es **inalcanzable** para el caso exacto que
  `lib/fallo-ia-texto.ts` vino a resolver, y a alguien que no conectó nada se le dice «la IA
  que tengo conectada me está rebotando por límite».
- **El 429 de la red de plataforma no se anota** (`anotarRebote429` escribiría en el
  workspace del cliente y le prendería «agotado» un proveedor que no tiene).
- **La cascada del cliente no tiene techo de tiempo ni `timeoutMs`**: 8 pasos × 45 s por
  llamada, y recién después arrancan los 25 s de la red de plataforma.

*2026-10-02*
