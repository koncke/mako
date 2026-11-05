# Hallazgos — Onboarding

El wizard del cliente nuevo (`app/onboarding/`, `lib/capas.ts`, `lib/onboarding-state.ts`) y
todo lo que decide si alguien llega a usar la app o se queda en la puerta.

## Lo que más muerde acá

1. **El paso `productos` no existe en el estado y revienta en silencio** — el cliente que
   vuelve queda varado ahí para siempre. [→](#el-paso-productos-no-existe-en-el-estado-y-el-error-no-se-ve)
2. **El grafo que existe es de CÓDIGO, no del negocio** — 4,1 MB de graphify sobre el repo.
   Quien lea la tarea #609 al pie de la letra le muestra al cliente la ingeniería de MaKo. [→](#el-grafo-que-existe-es-el-del-código-fuente-no-el-del-negocio)
3. **`WizardShell` en `fullscreen` NO es pantalla completa: es una tarjeta de 980 px** —
   cualquier diseño de "lienzo entero" cuesta 2-4 días más de lo que parece. [→](#wizardshell-fullscreen-es-una-tarjeta-centrada-no-un-lienzo)
4. **Los clientes reales no abandonan en los pasos de contenido: abandonan en los de
   conexión** — y el wizard no los deja salir a arreglarlo. [→](#dónde-se-cae-la-gente-de-verdad)
5. **No existe ninguna noción de plan gratuito, tope, cuota ni vencimiento** — y
   `lib/ia-cuotas.ts` se llama "cuotas" pero es otra cosa. [→](#el-plan-gratuito-no-existe-y-hay-un-falso-amigo-que-hace-perder-una-tarde)
6. **Ningún paso es salteable, y `skipped` tampoco libera la app.** Tres tareas ya aprobadas
   dependen de un concepto que no está construido. [→](#no-existe-el-paso-opcional)

---

## El estado del wizard (`lib/onboarding-state.ts`)

### El paso `productos` no existe en el estado, y el error no se ve

**Síntoma.** Un cliente completa productos, avatares, persona, personalidad y la matriz;
cierra el navegador; vuelve, y el wizard lo devuelve a la pantalla de productos como si no
hubiera hecho nada de lo posterior. Nada falla a la vista.

**Causa.** `PasoOnboarding` incluye `'productos'` y la capa `completo` lo lista en su orden,
pero el tipo `OnboardingState.steps` no lo tiene entre sus claves y `estadoInicial()` no lo
crea. El union `Body.step` del endpoint tampoco. Cuando el wizard cierra el paso, el server
ejecuta `s.steps[body.step].done = true` sobre `undefined`: TypeError adentro de
`patchEstadoOnboarding`, que por lo tanto **nunca persiste**, y la ruta devuelve 500. Del lado
del cliente ese POST no se chequea nunca —solo se mira `estado?.status`—, así que el wizard
avanza tan campante. El typecheck no lo ve porque el body llega de JSON sin validar.

**Por qué importa más de lo que parece.** El reinicio del onboarding que se le prometió a
Leila (tarea #625, «tu CRM y tu plan intactos, solo se resetea la bandera») la deja varada en
productos. La prueba de aceptación del rediseño choca de frente con este bug.

**Regla.** Agregar un paso a `PasoOnboarding` obliga a tocar **cuatro** lugares, no uno:
el tipo, `estadoInicial()`, el union del endpoint y la función `cuenta()` del retomar. Son
cuatro listas paralelas de lo mismo, que es exactamente lo que «una cosa, un lugar» prohíbe;
mientras sigan separadas, el próximo paso nuevo repite este bug.

**Vive en:** `lib/onboarding-state.ts:56-70,85-99` · `lib/capas.ts:24,116` ·
`app/api/onboarding/route.ts:171,324` · `app/onboarding/OnboardingWizard.tsx:391-392`

**Re-verificado el 10/08/2026, sigue vivo tal cual.** Y el arreglo tiene una puerta barata
que no estaba escrita: `getEstadoOnboarding` ya hace deep-merge del `steps` guardado sobre
el esqueleto de `estadoInicial()`, así que **agregar la clave arregla solo a los clientes ya
persistidos** — no hay que tocar `app_settings` de nadie. Lo que sí hay que hacer es no
repetir el antipatrón: `PASOS_ONBOARDING as const` en `lib/capas.ts` como fuente única, el
tipo derivado con `typeof …[number]`, el `steps` armado con `Object.fromEntries` y el union
del endpoint validado con un `esPasoOnboarding()` **en positivo**. Cuatro listas paralelas
mantenidas a mano garantizan que el paso número quince nazca con este mismo bug.

### El catálogo de productos: la IA pisa lo que el cliente escribió a mano

**Síntoma.** El cliente corrige la garantía de un producto, vuelve a pedir la sugerencia de
MaKo, y la corrección desaparece.

**Causa.** El GET le manda a `sugerirProductos()` solo el **nombre y el precio** de los
productos que ya existen, y con lo que vuelve hace un `UPDATE` de **todas** las columnas.
El modelo no puede «completar sin pisar» un texto que nunca vio. El dedup, además, matchea
por nombre exacto: una tilde o un plural ya crea un duplicado, y esa regla vive solo en la
prosa del prompt — sin la segunda capa determinista que AGENTS.md exige.

**Regla.** Merge **campo a campo**: la IA rellena lo vacío y nunca sobrescribe lo escrito.
Y al modelo se le pasa el producto **entero**, no un resumen — un LLM no preserva lo que no
recibe. La capa determinista es un
`unique (workspace_id, lower(btrim(nombre)))`, con saneo previo de las colisiones que ya
existan (contar filas en prod **antes** de aplicarlo).

De paso, dos cosas del catálogo que están escritas y no corren: `seedProductosDesdeOferta()`
no tiene **un solo call-site** —el producto que el cliente ya había declarado en el brief
nunca se siembra— y `upsertProducto` no escribe `orden`, así que el `.order('orden')` de
`listProductos` es inerte.

**Vive en:** `lib/productos-ia.ts:92-94` · `app/api/onboarding/productos/route.ts:61-65` ·
`lib/productos.ts:47,57-67,89-109`

### A veinte prompts les llega el brief con las PREGUNTAS adentro

**Síntoma.** MaKo escribe copy que suena a formulario, y a veces contesta la pregunta en vez de
usar el dato.

**Causa.** `perfilNegocioTexto()` emite el `label` de cada campo, y el label **es la pregunta**:
lo que sale es literal «Oferta — ¿Cómo se llama tu oferta?: Negocio que Escala · ¿Tenés
garantía? ¿Cuál?: 30 días». Eso viaja a ~20 features (todos los writers y analysts que piden el
brief). El repo ya resolvió el mismo problema para el grafo del segundo cerebro
(`lib/cerebro-grafo.ts:151-158`, que mapea label→sustantivo) y nunca lo llevó a los prompts.

**Regla.** Un `label` de formulario es texto de UI, no de prompt. Lo que se le manda a un modelo
es el **sustantivo** («Garantía: 30 días»), y esa traducción vive en un lugar solo.

**Y el dato que decide cualquier discusión sobre deprecar el grupo `oferta`:**
`perfilNegocioTexto()` alimenta **~20 features**; el catálogo `productos` alimenta **2**, las dos
en `lib/agente-contexto.ts`. `lib/mako-context.ts` —el system prompt de MaKo— **no lee productos
en absoluto**. Apagar el grupo dejaría ~18 features sin promesa, precio ni garantía.

**Vive en:** `lib/onboarding.ts:28-34,259-269` · `lib/agente-contexto.ts:64,107-115` ·
`lib/cerebro-grafo.ts:151-158`

*2026-08-10 ~productos-x-funnels + ~modelo-oferta-producto-funnel. El plan:
[productos-y-funnels-plan.md](productos-y-funnels-plan.md) · El modelo:
[modelo-oferta-producto-funnel.md](modelo-oferta-producto-funnel.md)*

### El retomar cuenta pantallas a mano, y ya está desfasado en `fase`

**Síntoma.** Un cliente que cierra el diagnóstico y vuelve aterriza en la pantalla del
resultado de la fase en vez de en el paso siguiente.

**Causa.** `cuenta()` traduce «paso cerrado» a «cuántas pantallas saltear», y para `fase`
dice `fasePreguntas.length + 1` = 7. El armado real pinta 8: las 6 preguntas, la pantalla de
canal que se inserta antes de `volumen`, y la del resultado.

**Regla.** Cualquier pantalla que se inserte **adentro** de un paso hay que sumarla a mano en
`cuenta()` o el retomar se desincroniza. Hoy es cosmético; con más pantallas por paso deja de
serlo.

**Vive en:** `app/onboarding/OnboardingWizard.tsx:228-243,310-323` · `lib/fase-diagnostico.ts`

### No existe el paso opcional

**Síntoma.** Se quiere hacer opcional el paso de agendar llamada (#610, decisión que Leila ya
ganó en la reunión), o sacar Calendly/Fathom del bloqueo (#302), o mover pasos a las tabs
(#54) — y no hay por dónde empezar.

**Causa.** El `action: 'skip'` existe solo en el server: **cero ocurrencias de `skip:true` en
la UI**. Y aunque se llamara, `onboardingPendiente()` devuelve `s.status !== 'done'`, con el
comentario explícito de que `'skipped'` **también** vuelve al wizard. O sea: el estado
`skipped` está modelado y no libera nada.

**Regla.** «Paso opcional» es una pieza de producto por construir (toca `puedeAvanzar`,
`OnboardingState`, `onboardingPendiente()` y el slot `extraFooter` que ya existe y el
onboarding no usa), no un flag. Tres tareas aprobadas cuelgan de ella: si se estiman sin
contarla, las tres se van de plazo.

**Vive en:** `lib/onboarding-state.ts:148-158` · `app/api/onboarding/route.ts` ·
`app/onboarding/OnboardingWizard.tsx`

---

## Dónde se cae la gente de verdad

**Síntoma.** La tarea #389 («mejorar el flujo de onboarding») no dice qué mejorar, y sin eso
cualquier cambio es opinión. Tres agentes propusieron instrumentar analítica de producto.

**No hacía falta: el dato ya estaba guardado.** El campo `step` de `app_settings` key
`onboarding.state` tiene la foto de cada workspace real. Consultado el 8/8/2026, los cuatro
clientes de verdad:

| Workspace | Estado | Qué pasó |
|---|---|---|
| Leila (ws11) | `done` | 12 pasos en **39 minutos** |
| Mauricio (ws1) | `done` | 12 pasos en **2 h 36 min** |
| Leandro (ws10) | `in_progress` | 10 de 12 pasos y **trabado hace 9 días** en conectar Meta |
| Ananda (ws5) | `pending` | **abandonó en el primer paso**, hace tres semanas |

**Causa.** Los dos que no terminaron murieron en un paso de **conexión**, no de contenido.
Leandro llenó nueve pantallas de negocio sin quejarse y se frenó en el anteúltimo paso, que
es el que ocurre **dentro de Meta Business** (usuario de sistema, 3 activos con control total,
8 permisos, expiración «Nunca»). Y como el wizard es bloqueante y no tiene salida, no puede
entrar a la app a hacer otra cosa mientras resuelve eso.

**Regla.** Antes de instrumentar nada, mirar `onboarding.state`. Y el corolario de diseño:
el trabajo de hacer el onboarding más lindo se agrega barato sobre los pasos que la gente ya
completa; la fuga está en los pasos que dependen de una consola ajena. n=4 es direccional,
no estadístico — pero es el único dato que hay, y es gratis.

**Vive en:** `lib/onboarding-state.ts:14` · `lib/capas.ts:116` ·
`scripts/probe-plan-superadmin.ts` (molde de consulta read-only contra prod)

---

## El grafo del «segundo cerebro»

### El grafo que existe es el del código fuente, no el del negocio

**Síntoma.** La tarea #609 pide, en una corrección post-reunión, «la versión COMPLETA
optimizada del grafo de MaKo» para mostrarle al cliente en el onboarding, y se declara
condición previa de #608.

**Causa.** El único grafo que existe es `/api/admin/graph` → `app/api/admin/graph/graph.html`:
**4.165.285 bytes, 4.440 nodos cuyos ids son archivos `.ts`** (`lib::ad_copy`) y cuyas aristas
son relaciones del AST. Lo genera **graphify sobre el repo**, está gateado a super-admin y baja
`vis-network` desde unpkg. Se abre en pestaña nueva y no se puede embeber:
`X-Frame-Options: DENY` + `frame-ancestors 'none'`. Es una herramienta de desarrollo.

Casi con seguridad la corrección salió de que en la reunión se mostró ese grafo como
**referencia visual** y quedó registrado como si fuera el que va al producto.

**Regla.** El grafo del onboarding es el del **negocio del cliente** (#608: hover «esto es tu
oferta»), construido de cero sobre datos que ya existen. El grafo de graphify no se le muestra
a un cliente nunca: enseñarle la arquitectura interna en el momento en que esperaba ver su
negocio es el opuesto exacto del efecto buscado. Y el problema de performance que motivó
#609 desaparece solo: un cliente al terminar el onboarding tiene ~30-60 nodos, no 4.440.

**Vive en:** `app/api/admin/graph/route.ts` · `app/api/admin/graph/graph.html` ·
`next.config.ts` (la CSP)

### El grafo del negocio ya existe, y vive en `/second-brain`

Se construyó **primero suelto y fuera del wizard**, por decisión de Martín: «hay que hacer
el grafo y ponerlo en la ruta de second brain, y luego cuando terminemos el diseño ahí sí
vemos dónde lo ponemos en el onboarding». El constructor es `lib/cerebro-grafo.ts` (lee las
once fuentes en paralelo) y el dibujo `app/second-brain/Grafo.tsx`. Cero dependencias nuevas.

Medido contra el workspace de un cliente real con el onboarding completo: **39 nodos y 38
aristas**. Las tres reglas de RESTA que lo mantienen legible, que son las que alguien va a
querer romper primero:

- **Un atributo no es un nodo.** El copy de una razón, los 10 rasgos de voz y los guiones son
  campos de otra cosa: van al hover. Pintarlos triplica el conteo y divide el significado.
- **El catálogo de MaKo no es del cliente.** Los 14 formatos de `BIBLIOTECA_ANGULOS` son
  iguales para todos: entran solo los que ESTE negocio usa.
- **Una razón y una celda de la matriz son la misma fila** (`RazonCelda`). Pintarlas como dos
  tipos de nodo son 9 nodos inventados.

**Vive en:** `lib/cerebro-grafo.ts` · `lib/cerebro-modelo.ts` · `app/second-brain/Grafo.tsx`

### Un componente cliente que importa un módulo con `server-only` rompe el build, y `tsc` da verde

**Síntoma.** `npx tsc --noEmit` sin un solo error, y la página tira 500 con *«You're importing
a module that depends on next/headers»*.

**Causa.** `Grafo.tsx` es `'use client'` e importaba **solo tipos y una constante** de
`lib/cerebro-grafo.ts`. Alcanza: el bundler sigue el módulo, no lo que se usa de él, y se
llevó al browser la cadena `cerebro-grafo → productos → workspace → auth → next/headers`. El
typecheck no lo ve nunca porque los tipos **son** correctos; lo que está mal es el grafo de
imports.

**Regla.** Lo que consumen las dos puntas va en un módulo de **datos puros**: sin
`server-only` y sin importar nada del server. Es la misma razón por la que `lib/capas.ts`,
`lib/angulos-data.ts` y `lib/formatos-archivo.ts` lo dicen en su cabecera. Acá el par quedó
`cerebro-modelo.ts` (puro, lo importan los dos) y `cerebro-grafo.ts` (el constructor).

Y el corolario que vale para toda la casa: **el typecheck no sustituye a levantar la página.**
Este bug pasó el `tsc` verde y lo cazó el primer render.

**Vive en:** `lib/cerebro-modelo.ts` · `app/second-brain/Grafo.tsx`

### Los labels del esquema son PREGUNTAS, y no sirven para nombrar nada

**Síntoma.** El grafo salió con nodos llamados «¿Tenés garantía? ¿Cuál?» y «¿Cuál es la
promesa principal? (la transformación)» — con signos de interrogación y con **voseo**, en una
UI que va en español neutro.

**Causa.** Se reusó `Field.label` de `DEFAULT_SCHEMA` como etiqueta del nodo. Esos labels
están escritos para un formulario: preguntan. Un nodo de un mapa no pregunta, nombra.

**Regla.** El label de un campo sirve para el formulario y para nada más. Cualquier otra
superficie que muestre el mismo dato necesita su propio nombre corto (`NOMBRE_CAMPO` en
`lib/cerebro-grafo.ts`). Y al copiar texto del esquema a una pantalla nueva, revisar el
voseo: la deuda ya está adentro del esquema y se propaga sola.

**Vive en:** `lib/onboarding.ts:17-49` · `lib/cerebro-grafo.ts` (`NOMBRE_CAMPO`)

### En un layout radial las etiquetas se pisan entre anillos, y hay que resolverlo aparte

**Síntoma.** 7 de 39 etiquetas superpuestas, con el layout funcionando perfecto.

**Causa.** Dos nodos de **anillos distintos** pueden caer casi a la misma altura: el de
adentro más abierto en ángulo, el de afuera más cerrado. Las posiciones estaban bien; el
texto es lo que se monta, porque se extiende en horizontal y el layout separa en radial.

**Regla.** Se mueve la ETIQUETA, nunca el nodo —la posición del punto significa a qué área
pertenece—, con un tope de corrimiento; pasado ese tope se esconde y vuelve en el hover. Una
etiqueta a 40 px de su punto parece de otro nodo, que es peor que no tenerla. Y conviene
medir el choque con una pasada analítica sobre el HTML renderizado en vez de a ojo: es
reproducible y da el número exacto (quedó en 0 de 39).

**Vive en:** `app/second-brain/Grafo.tsx` (`descongestionar`)

### Los pesos reales de las librerías de grafo (gzip, medidos sobre los dist)

`d3-force` + `d3-quadtree` + `d3-dispatch` = **6,1 KB** · `sigma` 47,1 KB (+ `graphology`
14,1 KB) · `cytoscape` 136,4 KB · `vis-network` 166,0 KB.

⚠️ **La conclusión que había acá era la equivocada, y queda como ejemplo.** Decía que a esta
escala ninguna librería se justifica y que un layout determinista sin física evitaba tres
bugs. Dos de esos tres bugs no existen (d3-force se congela solo y es determinista por LCG de
semilla fija), y el layout sin física produjo un organigrama radial que **no se parecía en
nada** al grafo tipo Obsidian que se había pedido. Lo dijo el dueño en una frase.

Lo que se hace hoy: `d3-force` **corre en el servidor** dentro de `construirCerebro()`, y al
browser viajan las coordenadas ya asentadas. El peso de la librería en el bundle del cliente
es **0 KB** — la discusión de KB estaba mal planteada desde el principio, porque asumía que
el layout se calculaba en el navegador.

El detalle completo está en [hallazgos-second-brain.md](hallazgos-second-brain.md).

### `view-transition-name` no sirve para animar el nacimiento de un nodo

**Síntoma.** «El dato vuela de la tarjeta al grafo con `view-transition-name`: 0 KB, cinco
líneas» — lo propusieron dos conceptos como su efecto estrella.

**Causa.** Dos problemas independientes. (1) `view-transition-name` no captura elementos hijos
de un `<svg>` en Chromium: solo elementos HTML y el `<svg>` raíz. Si el destino es un
`<circle>` o un `<g>`, no hay interpolación y **falla en silencio**. (2) React 19.2.4 no
exporta ninguna `ViewTransition` (verificado sobre el `react` instalado): con render
concurrente, `document.startViewTransition(() => setState(...))` no commitea el DOM adentro
del callback.

**Regla.** Para el vuelo del dato hacia un nodo, FLIP a mano: `getBoundingClientRect()` del
origen, coordenadas del destino y `element.animate()` sobre un fantasma en el DOM. Sigue siendo
cero dependencias, pero son ~40 líneas y medio día, no cinco líneas gratis. View Transitions
sí sirve para el cruce entre pantallas, que es HTML puro.

---

## La cáscara y el panel (`app/_components/WizardShell.tsx`)

### `WizardShell` fullscreen es una tarjeta centrada, no un lienzo

**Síntoma.** Se diseña un onboarding «a pantalla completa con el grafo de fondo» asumiendo que
la rama `fullscreen` ya lo permite, y la estimación se va 2-4 días.

**Causa.** `fullscreen` es `position: fixed; inset: 0`, pero su hijo es una **tarjeta**:
`maxWidth: escenario ? 980 : 620`, `minHeight: 560`, `maxHeight: calc(100vh - 96px)`, con el
grid `.mk-svc-modal` (336 px + 1fr) adentro. El `escenario` es una **columna de 336 px**, no
un fondo.

**Regla.** Antes de prometer un lienzo, mirar de qué tamaño es la caja. Y si se abre una rama
nueva del shell, contar que de ese archivo dependen los siete consumidores de
`PanelMarketing` (`OnboardingChatAgent`, `SecuenciaWizard`, `IntegracionesBoard`,
`ServicioConfigForm`, `OnboardingTabs`, `OnboardingWizard`, `PanelActivacion`): tocarlo mal
rompe /integraciones y el onboarding de cada tab de una.

**Vive en:** `app/_components/WizardShell.tsx:280-320` · `app/_components/PanelMarketing.tsx`

### A ≤820 px la columna del escenario colapsa a alto 0 y desaparece sin error

**Síntoma.** En el teléfono el panel lateral simplemente no está. Nada tira error.

**Causa.** La media query de 820 px pasa el grid a `grid-template-rows: auto minmax(0,1fr)` y
pone `.mk-svc-carrusel { min-height: 0 }`, pisando el `min-height: 150px` de la regla base.
Un SVG con `height: 100%` adentro de eso mide 0 px.

**Regla.** Cualquier cosa que se ponga en el `escenario` necesita un alto **explícito** en
mobile (`clamp(200px, 30vh, 320px)`), no heredado.

**Vive en:** `app/globals.css:329-334,343,371-388`

---

## El contenido de los pasos

### El funnel se siembra con una plantilla fija que ignora el canal que el cliente eligió

**Síntoma.** El cliente declara su canal en el diagnóstico y le queda un funnel que no pidió.

**Causa.** En `case 'fase'` se guarda el canal en `onboarding.funnel_tipos` y **acto seguido**
se hace `const tpl = FUNNEL_TEMPLATES[0]` + `saveFunnel(...)` sin mirarlo. `FUNNEL_TEMPLATES[0]`
es `highticket` con el `DEFAULT_PIPELINE`: **17 etapas y 30 transiciones**, con dos etapas de
Reunión. El `case 'funnel'` del mismo endpoint sí sabe hacerlo bien y **no tiene ningún caller**.

**Regla.** Las etapas del funnel no entran al grafo del segundo cerebro hasta que se arregle
esto: mostrarle a alguien que eligió «carrito» dos etapas de Reunión, en la única pantalla
cuyo argumento entero es «esto es tuyo», es peor que no mostrar nada. Y es exactamente el nodo
que alguien va a querer agregar «porque el dato ya está».

**Vive en:** `app/api/onboarding/route.ts:252,273` · `lib/pipeline.ts`

### El onboarding entero corre con la key gratis que carga el propio cliente en el paso 2

**Síntoma.** Si esa key se agota a mitad del recorrido, el cliente queda trabado en un wizard
bloqueante que no lo deja entrar a la app a cambiarla (#295).

**Causa.** Son ~25-30 llamadas de IA a lo largo de los 12 pasos, todas contra la key de Gemini
que el cliente saca de aistudio.google.com en el paso `gemini` (puesto 2 de 12). El free tier
son 250 pedidos/día.

**Regla.** Mover el Archivero antes del paso `gemini` no es una decisión de orden: es una
decisión de **costo por alta** (¿MaKo paga las primeras llamadas con key de plataforma?, ¿con
qué tope?, ¿cómo se audita?). No se puede resolver escribiendo código.

**Vive en:** `lib/capas.ts:116` · `lib/ia-cuotas.ts:18-24`

### El plan gratuito no existe, y hay un falso amigo que hace perder una tarde

**Síntoma.** La tarea #611 pide videos que disparan «al llegar al límite del plan gratuito», y
la #310 un acceso de demo de 3 a 7 días.

**Causa.** No hay disparador que disparar. `CapaId` son tres (`pm | completo | superadmin`),
`workspaces` solo tiene `activo | pausado`, la sesión solo muere si el **usuario** está
suspendido, y no hay tabla de planes, tope, cuota por workspace ni fecha de expiración. Cero
apariciones de `plan_free` o `trial`.

**El falso amigo:** `lib/ia-cuotas.ts` se llama «cuotas», pinta un gauge y parece justo eso.
Son los **free tiers de los proveedores de IA** (gemini 250 rpd, groq 500k tokens/día…), para
rotar antes del 429. No tiene nada que ver con lo que el cliente compró.

**Regla.** #611 y #310 no son «difíciles», son **inejecutables** hasta que exista una
definición de producto. Estimarlas antes de eso es inventar.

**Vive en:** `lib/capas.ts:26` · `lib/workspace.ts:212-214` · `lib/ia-cuotas.ts:18-24`

### ElevenLabs está conectada y no la usa nada

La key se guarda y se verifica contra `/v1/user` y `/v1/models`, y ahí termina: **cero
llamadas a `/v1/text-to-speech` en todo el repo**. Los audios que el producto manda hoy los
graba el dueño con su voz, y eso es deliberado (`lib/audios-paso.ts`, que además define el
criterio que conviene reusar para los videos: *«no es un audio de bienvenida y ya: son TRES
situaciones distintas»*).

**Vive en:** `lib/metodo-verificar.ts:269-288` · `lib/audios-paso.ts:14-18`

### ⚠️ `buildEstado(true)` reescribe el brief con lo que sabe el Archivero, y borra lo que entró por el wizard

**Síntoma.** El cliente contesta en el wizard su objetivo a 90 días y lo que lo frena; si
después sube un documento al Archivero o corrige un campo a mano, esas respuestas desaparecen.
Sin error. *(Leído en el código el 16/09/2026; no medido con datos de clientes.)*

**Causa.** El brief tiene dos puertas y un recálculo que conoce una sola:

- El wizard guarda cada respuesta en `mako.onboarding.answers`, mergeando (`case 'brief'`,
  `app/api/onboarding/route.ts:235-243`). Eso incluye campos que el Archivero no extrae:
  `negocio_objetivo`, `negocio_freno`, `marca_*` (los que `esCampoArchivero` no reconoce,
  `lib/archivero.ts:73-75`).
- `buildEstado(true)` hace `saveAnswers(computeEffective(files, manual).answers)`
  (`lib/archivero.ts:172-175`), y `saveAnswers` **reemplaza** la clave entera
  (`lib/onboarding.ts:67-69`). El efectivo trae solo lo de los documentos y lo manual: lo demás
  se borra. Lo llaman la subida de un documento (`app/api/onboarding/archivero/route.ts:122`) y
  la edición manual (`app/api/onboarding/archivero/manual/route.ts:43`).
- Y el reverso: en `computeEffective` lo manual gana **siempre** (`lib/archivero.ts:147-151`).
  Un campo que entró por lo manual y después se corrige en el wizard vuelve al valor manual en
  el próximo `buildEstado(true)`.

**Regla.** Cada campo del brief tiene UNA puerta: los del Archivero (`negocio_que_hace`,
`oferta_*`, `avatar_*`) van a lo manual; los demás, directo a las answers. Y recalcular es
quitar **solo las claves que aportaba el efectivo anterior** y mezclar el nuevo encima, nunca
reescribir la clave entera. Molde: `persistirBrief` y `completarHuecoPerfil` en
`lib/api-mako/areas/negocio.helpers.ts:131-164`.

**Lo que quedó SIN hacer.** Las dos rutas del Archivero siguen llamando a `buildEstado(true)`; el
arreglo va en `buildEstado` (`lib/archivero.ts`). La API de MaKo no lo tocó porque es la lib que pinta
la pantalla del Archivero, y lo esquiva por su lado.

**15/10/2026:** `computeEffective` se mudó, sin cambios, a `lib/archivero-registro.ts` (sin
`server-only`, para que un test lo ejecute; `lib/archivero.ts` la re-exporta). Y El Archivero tiene una
SEGUNDA PUERTA que no pasa por `buildEstado`: ver «El Archivero tiene una segunda puerta» más abajo.

**Vive en:** `lib/archivero.ts` (`esCampoArchivero`, `buildEstado`) · `lib/archivero-registro.ts`
(`computeEffective`) · `lib/onboarding.ts:67-69` ·
`app/api/onboarding/route.ts:235-243` · `app/api/onboarding/archivero/route.ts:122` ·
`app/api/onboarding/archivero/manual/route.ts:43` · *2026-09-16 api-mako-areas*

### ⚠️ Avatares, lead magnets y cara de marca: si la lectura falla la lista vale `[]`, y «editar uno» la reescribe así

**Síntoma.** Con un 5xx pasajero de Supabase, editar UN avatar, borrar UNA foto o subir una
nueva deja la lista con un solo elemento —o la cara de marca sin sus fotos ni su descripción— y
contesta ok.

**Causa.** Los getters leen con `getSetting`, que convierte el error en `null` y de ahí en `[]`,
`''` o `{}`: `getAvatares` (`lib/avatares.ts:61-68`), `getContextoAvatares` (:77-79),
`getEntregables` (`lib/entregable.ts:54-61`), `getPersona` (`lib/persona.ts:33-40`),
`getAnswers` (`lib/onboarding.ts:62-66`). Todo read-modify-write encima pierde lo que había, y
**ya pasa en la app, sin la API**: `setPersonaDescripcion`, `addPersonaFoto` y
`deletePersonaFoto` (`lib/persona.ts:83-106`) releen con `getPersona()` y reescriben la clave
entera, y los llama `app/api/onboarding/persona/route.ts:45,57,72`. «Afinar» los avatares suma
las respuestas nuevas a un contexto previo que, si no se pudo leer, vale `''`
(`app/api/onboarding/avatares/route.ts:75-77`): pisa lo que el cliente había precisado.

**El diagnóstico obvio era el equivocado.** «Leer con `getSettingEstricto` antes de escribir» no
alcanza si después se escribe con la función de la lib, que vuelve a leer por su cuenta (ver
[hallazgos-infra.md](hallazgos-infra.md) → `getSetting`). Y desde afuera no hay cómo escribir
sobre la lectura estricta: `normalizarAvatar` (`lib/avatares.ts:48`) y `normalizarEntregable`
(`lib/entregable.ts:42`) no se exportan, y `setPersona` es privada (`lib/persona.ts:41`).

**Lo que quedó SIN hacer.** Un getter estricto exportado por cada lib (avatares, lead magnets) y
setters de persona que escriban sobre el valor leído, usados también por las rutas de onboarding:
hasta entonces la pantalla sigue con el agujero. La API de MaKo lo esquiva con dos parches que
son deuda: como no puede normalizar, exige que el getter de la lib devuelva la **misma cantidad**
de ítems que la lectura estricta o no escribe (`listaEstricta`), y para la persona replica
`getPersona` y escribe `mako.persona` con `setSetting` — si cambia la forma de `PersonaData`, hay
dos lugares (`lib/api-mako/areas/negocio.helpers.ts`).

**Vive en:** `lib/avatares.ts:48,61-79` · `lib/entregable.ts:42,54-61` · `lib/persona.ts:33-43,83-106` ·
`app/api/onboarding/persona/route.ts` · `app/api/onboarding/avatares/route.ts:69-79` ·
*2026-09-16 api-mako-areas*

### ⚠️ «Afinar» los avatares escribe el contexto antes de saber si la IA contestó

**Síntoma.** El contexto de avatares acumula las mismas respuestas repetidas. No hay pantalla
que lo borre, y entra a todos los prompts de avatares.

**Causa.** `generarAvatares()` no acepta el contexto por parámetro: lo lee de la base
(`lib/avatares.ts:130-132`). Entonces «afinar» lo escribe primero y recién después genera
(`app/api/onboarding/avatares/route.ts:75-79`). Si la cascada gratis falla —por ejemplo, con la
key del cliente agotada— la ruta devuelve 422 con el contexto ya escrito; el cliente
reintenta con las mismas respuestas y se vuelven a sumar, porque la ruta no desduplica.

**Regla.** Lo que alimenta una generación que puede fallar viaja en memoria, y se persiste recién
cuando lo generado quedó guardado.

**Lo que quedó SIN hacer.** Un `contextoExtra` en `generarAvatares` (`lib/avatares.ts:130`), y
mudar a `lib/avatares.ts` el `regenerarAvatares` que hoy vive en
`lib/api-mako/areas/negocio.helpers.ts:202-231`, con la ruta llamándolo. Como la API no pudo
cambiar la firma, escribe, genera y **restaura** el valor anterior en un `finally` si la lista no
se guardó, desduplicando por texto normalizado. Eso deja una ventana en la que otra lectura del
contexto ve líneas que todavía no valen.

**Vive en:** `lib/avatares.ts:76-82,130-135` · `app/api/onboarding/avatares/route.ts:69-79` ·
*2026-09-16 api-mako-areas*

### La regla del «brief suficiente» está escrita siete veces, y la lógica de tres pasos vive en las rutas

**Síntoma.** Ninguno todavía. El día que alguien cambie el mínimo en una copia, las otras siguen
con el viejo: MaKo propone generar sobre un brief que la lib después rechaza. Y en la API de MaKo
eso cuesta más que un mensaje distinto, porque ahí la precondición se chequea al PROPONER, y una
propuesta que pasa ese chequeo y falla al confirmar ya no se puede reintentar.

**Causa.** `!brief.trim() || brief.replace(/[—\-·\s]/g, '').length < 20` está copiada en
`lib/avatares.ts:133` y `:227`, `lib/entregable.ts:163` y `:207`, `lib/personalidad-store.ts:59`
y `lib/razones.ts:173`. La séptima la sumó la API (`briefSuficiente`,
`lib/api-mako/areas/negocio.helpers.ts:79`), porque no hay una exportada. Es la misma familia
que la lógica que vive inline en las rutas y un segundo canal tuvo que copiar
(`aplicarSugerenciasProductos` de `app/api/onboarding/productos/route.ts`, `tabsPorConfigurar` de
`app/api/onboarding/listo/route.ts`, `regenerarAvatares` de la de avatares) o directamente no pudo
ofrecer: `procesarLink` (`app/api/onboarding/archivero/route.ts:170`), por eso agregar una web al
Archivero no existe en la API.

**Regla.** «Una cosa, un lugar»: la precondición se exporta de `lib/onboarding.ts`, y la lógica de
un paso vive en `lib/` con la ruta como cáscara. Un segundo canal que encuentra la lógica en una
ruta la copia o no la ofrece.

**Lo que quedó SIN hacer.** Exportar la regla y que las seis copias de las libs la importen; mudar
esas tres funciones a `lib/productos.ts`, `lib/onboarding-pendientes.ts` y `lib/avatares.ts`, y
`procesarLink` a `lib/archivero.ts`. Está anotado en la cabecera de
`lib/api-mako/areas/negocio.helpers.ts:18-24`.

**Vive en:** `lib/avatares.ts:133,227` · `lib/entregable.ts:163,207` · `lib/personalidad-store.ts:59` ·
`lib/razones.ts:173` · `app/api/onboarding/{productos,listo,avatares,archivero}/route.ts` ·
*2026-09-16 api-mako-areas*

---

## Decisiones del dueño (8/8/2026)

**Cerradas:**

1. **El grafo del onboarding es el del NEGOCIO del cliente**, construido de cero. #609 se
   reescribe como «optimizar el grafo interno de desarrollo», prioridad baja, sin relación
   con el onboarding. Ya está construido: ver arriba.
2. **El artefacto se llama «tu segundo cerebro»** — el término que él mismo usó en la reunión
   y el que el producto ya tiene (`/second-brain` existe como ruta y como item del sidebar).
   Es lo que se dice en el video de cierre.
3. **El grafo se diseña primero SUELTO, en `/second-brain`**, y dónde entra en el onboarding
   se decide mirándolo andar. Textual: «no quiero reutilizar el que ya tenemos en MaKo, se ve
   feo, se siente lageado, no se entiende». Eso deja en suspenso la pregunta del panel de
   336 px vs el lienzo completo, que era la más cara de responder a ciegas.
4. **El paso de la key de IA se queda donde está, pero se le agregan MÁS proveedores
   gratuitos.** Y el motivo no es teórico, es un fallo que ya ocurrió en producción: «ya ha
   pasado que el onboarding es muy largo, termina consumiendo todos los tokens de Gemini y ya
   no se puede avanzar». O sea: el free tier de Gemini (250 pedidos/día) no alcanza para las
   ~25-30 llamadas del recorrido cuando alguien reintenta pasos, y el cliente queda trabado
   en un wizard bloqueante que no lo deja entrar a arreglarlo. La pieza para reusar existe y
   NO hay que escribir otra: `lib/ai-cheap.ts` ya recorre proveedores en orden y
   `lib/ia-cuotas.ts` los ordena por cuota disponible — lo que falta es pedirle al cliente
   varias keys en el paso, no una. Esto reemplaza el enunciado de #295, que pedía «una
   segunda API key» del mismo proveedor.

**Abiertas todavía:**

5. Qué es el plan gratuito y cuáles son sus topes — bloquea #611 y #310, que hoy son
   inejecutables.
6. Si se construye el paso opcional — bloquea #610, #302 y #54.
7. Cuántas sesiones puede durar el onboarding (hoy es «dos, sin admitirlo»).

Relacionado: [hallazgos-ui.md](hallazgos-ui.md) (el `WizardShell` y la pila de modales) ·
[hallazgos-ia.md](hallazgos-ia.md) (la cascada barata y los topes de salida) ·
[hallazgos-plan.md](hallazgos-plan.md) (#164, la Retro que miente con solo Meta conectado, que
es prerrequisito de cualquier cierre con números).

## Hay un cliente parado hace nueve días, y no es un bug de Meta

**Vive en:** `lib/onboarding-state.ts:127-137` (`onboardingPendiente`) · `app/api/onboarding/route.ts:173,353` · `app/onboarding/OnboardingWizard.tsx`

De cuatro clientes reales, **los dos que no terminaron el onboarding murieron en un paso de
CONEXIÓN, no de contenido**. Leandro llenó nueve pantallas de negocio sin quejarse y quedó
trabado en el paso de Meta — que ocurre **adentro de la consola de Meta**, no de MaKo:
usuario de sistema, tres activos, ocho permisos, expiración «Nunca».

**El wizard bloqueante no causó el tropiezo. Convirtió un tropiezo en un abandono.** Como
no hay salida, tampoco puede entrar a hacer otra cosa mientras lo resuelve.

**Y el «saltear» está modelado y no libera nada** — las tres capas fallan por separado:

1. `action: 'skip'` es un flag del body que **no usa nadie en la UI**: cero ocurrencias de
   `skip: true` en `app/`.
2. Aunque se usara, `onboardingPendiente()` devuelve `s.status !== 'done'`, así que
   `'skipped'` **también rebota al wizard**.
3. El slot para ofrecerlo ya existe y está sin usar: `extraFooter` de `WizardShell`.

O sea: el estado existe, el endpoint lo acepta, la UI no lo manda y el guard no lo respeta.
Tres piezas que por separado parecen completas.

**La regla:** un estado que el modelo contempla pero ningún guard respeta **no existe**.
Antes de dar por hecho que algo es «opcional», seguí el valor hasta el `if` que decide —
si ningún `if` lo mira, la opción es decorativa. Y el guard va en POSITIVO: la lista dice
CUÁLES pasos se pueden saltear, nunca «todos menos», porque la negativa se queda vieja
sola con cada paso nuevo.

## RESUELTO (16/08/2026) — la salida, y las tres cosas que aparecieron al verificarla

**Vive en:** `lib/capas.ts` (`PASOS_POSTERGABLES`) · `lib/onboarding-contrato.ts` ·
`lib/onboarding-pendientes.ts` · `app/onboarding/OnboardingWizard.tsx` · `app/general/page.tsx`

Cierra el hallazgo de arriba. Se posterga **un paso**, no todo, y solo los que se cierran en
un sistema de afuera: `integraciones` y `tabs` (el OTP de WhatsApp). Los de contenido siguen
siendo obligatorios — el cliente los puede contestar ahora. El `skip?: boolean` que ponía el
estado entero en `'skipped'` se fue: no lo llamaba nadie y su único efecto posible era
encerrar, porque `'skipped'` no libera y no había forma de volver atrás.

**El invariante general NO tiene validación automática, y hay que decirlo.** «Un paso solo es
postergable si nada río abajo lo necesita» no se puede chequear con un dato: quién depende de
quién vive en el `puedeAvanzar` de `OnboardingWizard.tsx`, como una cadena de ternarios en el
cliente. Lo que sí quedó amarrado es lo de al lado — `POSTERGABLE_TXT` y los verificadores de
`onboarding-pendientes.ts` **no compilan** si entra un paso sin frase o sin forma de saber si
sigue faltando. Es la distinción de AGENTS.md: cuando la segunda capa no se puede escribir, se
escribe el comentario, no se supone.

### Lo que apareció verificándolo en el navegador

Las tres son de la misma familia y ninguna se ve leyendo el código de a un archivo.

**1. Retomar el wizard aterrizaba UNA PANTALLA ANTES.** Había una `cuenta(paso)` que repetía
cuántas pantallas produce cada paso — la misma lista que se arma treinta líneas más arriba,
escrita de nuevo. El paso `fase` produce una pantalla extra (la del canal) que `cuenta` no
sabía. Medido: con todo cerrado menos el teléfono, caía en la matriz de anuncios. **Y el bug
llevaba meses tapado por otro**: la cuenta corta evitaba que, con todo hecho, el índice se
pasara del largo del array. Dos errores que se cancelaban. Ahora se BUSCA en `pantallas`.

**2. La pantalla de Retro decía «✦ CON UNDEFINED CONECTADO»**, en mayúsculas y arriba de todo.
Declara `servicio: 'meta'` sin `nombre`, y `nombre` solo lo traen las pantallas de conexión.
Un cliente lo estaba viendo.

**3. El estado de un paso vivía en CUATRO lugares** y la copia del cliente se acababa de
desfasar otra vez: `postergado` existía en el server, en la base y en el endpoint, y
`OnboardingWizard.tsx` seguía tipando `{ done: boolean }` — o sea, **la pantalla que tiene que
reaccionar al dato era la única que no sabía que existía**. Es exactamente el bug que hizo
nacer roto el paso `productos`, repetido. Ahora sale de `lib/onboarding-contrato.ts`.

### El recordatorio se apaga solo, y por qué eso obligó a partir el módulo

`pendientesOnboarding()` **no le cree al flag**: cruza `postergado` con la conexión REAL de
hoy. Verificado contra el ws3: con Meta conectado no aparece nada, y con el teléfono sin
verificar aparece solo ése. Un flag que hay que acordarse de bajar a mano es el que dentro de
un mes le pide a alguien algo que ya hizo.

Para poder testear todo esto hubo que sacar las reglas puras a `lib/onboarding-contrato.ts`
**sin `server-only`**: lo que deciden es si un cliente entra a la app o vuelve al wizard, y
metido en el módulo que lee `app_settings` ningún test lo podía importar. Es el mismo criterio
que `exigirClienteDePrueba` y `lib/model-catalogo.ts`. La red es `tests/onboarding-postergar.test.ts`.

### Lo que quedó SIN hacer

- **`estado.step` se escribe y no lo lee nadie.** El tipo lo documenta como «paso actual del
  wizard (para retomar donde quedó)» y el retomar se calcula desde `steps`. Vive en
  `lib/onboarding-contrato.ts` y se escribe en `app/api/onboarding/route.ts` (`case 'paso'`).
  O se usa o se borra: un campo que promete algo que no cumple manda a leer el lugar equivocado.
- **Dos fuentes para «el teléfono está verificado».** El GET de `/api/onboarding` devolvió
  `contacto.verificado: false` (de `getContactoReportes`) mientras
  `getEstadoVerificacionContacto` decía `true`, para el mismo workspace y en el mismo
  instante. La segunda es la que gobierna el gate. Vive en `lib/perfil.ts` y
  `lib/mako-grupo.ts:282`.
- **Postergar `gemini` sigue sin poder hacerse**, y es el paso 2 de 12. Un cliente sin key de
  Google no pasa de ahí. Habilitarlo pide postergar en cascada los seis pasos que lo consumen.

*Corrida del 16/08/2026 — implementación de la salida, verificada con Playwright contra el ws3.*

## Una credencial guardada no es una credencial que funciona

**Vive en:** `lib/credenciales.ts:217-228` (`estadoCampo`) · el paso `gemini` del wizard

Al recargar el onboarding, `geminiConectada` sale de `data.geminiConfig.configurado`, y
`estadoCampo` devuelve `configurado: true` **con solo tener un valor descifrable guardado**.

Una llave que dejó de funcionar —el caso exacto del free tier de Gemini agotado— **pasa el
gate de `puedeAvanzar`**. El cliente avanza y la IA se muere tres pantallas después, en un
lugar que no tiene nada que ver con la causa.

**La regla:** «hay algo guardado» y «anda» son dos preguntas distintas. Donde el paso
siguiente depende de que la credencial FUNCIONE, se re-verifica contra el proveedor; el
estado guardado solo sirve para no volver a pedirla.

## El movimiento que no transporta un dato es el antipatrón, y hoy está en producción

**Vive en:** `app/onboarding/OnboardingWizard.tsx:822-881` (`FaseLoopAnimado`)

La columna del escenario corre un loop autónomo que recorre las cinco fases cada 2.800 ms.
Es bonito y no dice nada del cliente que lo está mirando.

Sirve como definición operativa del antipatrón del §12, que es más útil que la lista de
estilos prohibidos: **un gradiente morado no es feo por morado, es feo porque no informa.**
El test que queda, y se puede correr en un review: *por cada cosa que se mueve, nombrá el
dato del cliente que transporta.* Si no hay ninguno, no se mueve.

⚠️ **Y ningún loop de rAF de la casa tiene guarda de visibilidad** — ni
`IntersectionObserver` ni `document.visibilityState`. Es el mismo antipatrón que el polling
global de `docs/hallazgos-infra.md`, que hacía 1.020 req/h con la pestaña minimizada.

## El trabajo pesado corre en el peor momento posible

**Vive en:** `app/api/onboarding/plan-arranque/` (`maxDuration = 120`)

El plan de arranque se genera **al final**, cuando el cliente ya terminó las 19 pantallas y
lo único que quiere es salir. Tarda decenas de segundos y el botón dice «MaKo está armando
tu plan…».

Disparándolo al entrar al Archivero (pantalla 11) en background, la espera pasa a cero sin
optimizar una línea del endpoint. **La mejora de rendimiento más barata de este flujo no
está en el endpoint: está en cuándo se llama.**

## El plan del onboarding nuevo

La propuesta completa —metáfora, promesa, las 20 pantallas, la pieza interactiva del
cierre y el plan por fases— vive en [onboarding-nuevo.md](onboarding-nuevo.md). Sale de una
corrida de 9 agentes (4 frentes + 4 críticos + síntesis) que investigó Opal, ~20 apps con
buen onboarding, el flujo actual y las opciones técnicas.

Los dos titulares, para no tener que abrirlo:

- **No hay gema 3D.** No por el peso (three son 182 KB gzip) sino porque la opción 3D
  **obliga a construir igual el fallback 2D** para reduced-motion y para el ~5% de máquinas
  sin WebGL decente: no ahorra trabajo, lo duplica. La metáfora sale del producto — el mapa
  del segundo cerebro, que ya tiene modelada la autoría `pendiente`, o sea que «el hueco
  que se llena» ya está en el tipo de datos.
- **La promesa NO lleva un número inventado.** Los «6+ años» de Opal necesitan 99,5 años de
  vida para cerrar con su propia aritmética. Con cuatro clientes y dos completados no hay
  cohorte: el número tiene que salir de un `count` de sus propias respuestas.

## El video de la bienvenida: la cláusula que decide no es la de «uso comercial»

**Vive en:** `app/onboarding/Bienvenida.tsx` (`IntroCerebro`, prop `videoIntro`)

Buscando un clip de ojo→cerebro con licencia libre (17 agentes, cada candidato verificado
por un escéptico aparte), lo que decide no resultó ser lo obvio.

**Los dos que pasaron, medidos con HTTP HEAD contra el CDN y no con la ficha:**

| Qué | Sitio | Licencia | Peso real |
|---|---|---|---|
| Ojo macro castaño, iris llenando el cuadro | Pexels | Pexels License | 1080p60, 4 s, **1,78 MB** |
| Neuronas 3D sobre fondo casi negro | Pixabay | Pixabay Content License | 1080p30, 6 s, **3,15 MB** |

**LA TRAMPA ESTÁ EN PIXABAY, NO EN EL «USO COMERCIAL».** Las dos licencias permiten uso
comercial y ninguna exige atribución — hasta ahí las dos parecen iguales. La diferencia es
la cláusula *standalone* de Pixabay, textual:

> «You cannot sell or distribute Content on a Standalone basis. Standalone means where no
> creative effort has been applied to the Content and it remains in substantially the same
> form as it exists on our website.»

Y Pixabay **define** que un filtro, un cambio de color, un resize o un crop **siguen siendo
standalone**. O sea que oscurecer el clip con un `filter: brightness()` para que pegue con
`#14161B` NO alcanza: servir ese mp4 desde nuestro CDN es, en la lectura conservadora,
distribuirlo. Pexels no tiene esa cláusula; la suya que sí aplica es otra —**el clip no
puede pasar a ser parte de la marca**—, o sea que ese ojo puede ser fondo de pantalla pero
nunca isotipo de MaKo.

**La regla que queda: leer la cláusula de OBRA DERIVADA, no la de uso comercial.** «Permite
uso comercial» es la que todo el mundo chequea y la que casi nunca es el problema.

**Y el hallazgo que ahorra la próxima búsqueda: el asset no existe.** Ningún clip gratis
hace ojo → zoom → neuronas → flash. Hay que encadenar dos y programar el zoom y el flash
igual — y una vez que estás programando esa mitad, la parte de las neuronas conviene en
código: 2-3 KB contra 3,15 MB, cero cláusula, y los colores salen de los tokens `--grafo-*`
en vez de un `hue-rotate` sobre el naranja de otro.

**Lo que NO se verificó, y hay que decirlo:** ningún clip trae *model release* —ni Pexels ni
Pixabay lo garantizan, las dos trasladan esa responsabilidad a quien lo usa—; de los clips
de Pexels se vio el frame de portada, no el video corriendo; y dos candidatos de Pixabay
están marcados por el propio sitio como generados o modificados con IA.

*Corrida del 16/08/2026 — 17 agentes, cada candidato verificado leyendo su página de licencia.*

---

## ⚠️ «Seguir sin Meta» posponía el mismo muro tres pantallas, y ahí no había salida

**Síntoma reportado:** *«el paso de Seguir sin Meta no funcionó, luego igualmente le pide sí
o sí»*.

**El botón hacía su trabajo:** marcaba el paso postergado y saltaba la sección de
integraciones entera. Lo que estaba mal venía después: la pantalla de la primera Retro
declaraba `servicio: 'meta'` **para heredar los slides de Meta**, y ese mismo campo hacía DOS
cosas — elegir la decoración *y* bloquear el avance. Con lo cual la Retro le dibujaba adentro
el formulario del token y no lo dejaba pasar. Y esa pantalla **no es postergable**: ahí no
quedaba ninguna salida.

Es «cada pregunta, su campo»: *«¿de qué servicio hablo?»* (ícono, slides, eyebrow) y *«¿qué
servicio EXIJO?»* son dos preguntas, y meterlas en una hizo que **lo cosmético arrastrara un
bloqueo** a una pantalla que nunca quiso bloquear.

**Las tres reglas que quedan:**

1. **`exige` es lo único que bloquea**, y solo lo declaran las pantallas `int:*`, que SON las
   de conectar. `servicio` queda para lo cosmético.
2. **Un servicio POSTERGADO no bloquea río abajo.** Era la mitad que faltaba: si el cliente ya
   dijo «seguí sin esto», ninguna pantalla posterior puede volver a exigirlo. Un botón que
   ofrece una salida y después no la da **es peor que no ofrecerla** — la próxima vez el
   cliente no le cree.
3. **Y postergar NO esconde el formulario**, que es el error inverso y sale igual de caro: si
   vuelve atrás a conectar, tiene que poder. Lo que cambia con el postergado es solo si FRENA.
   El texto también: en vez de «Conectala para seguir» lee «La dejaste para después — podés
   seguir». Repetirle que la conecte es desdecirse del botón que acaba de apretar.

**Vive en:** app/onboarding/OnboardingWizard.tsx (`exige`, `esPantallaDeConexion`,
`servicioReq`, `pasoPostergado`) · tests/onboarding-postergar.test.ts *— 16/08/2026*

## ⚠️ El taller de paletas se le aplicaba a los CLIENTES, y esconder el aviso lo empeoró

**Síntoma:** *«aún no están sus tareas y están todos los botones mal»*. En el tablero de un
cliente: el header decía «27% · 4/15 del plan» —las 15 tareas cargadas, las mismas que están
en la base— y las tarjetas, las columnas y los botones estaban **dibujados del color del
fondo**. No faltaba nada: no se veía nada.

**Causa:** `<TemaCandidato>` está montado en el **layout raíz** y su `<script>` corre antes
del primer pintado aplicando el tema guardado en el `localStorage` **del navegador**, sin
preguntar quién es. Los temas del taller incluyen paletas **claras** (`true-north` pone
`--ink: #2E3440`), así que sobre el lienzo oscuro queda todo del color del fondo. Alcanza con
abrir la app en un browser donde alguien probó paletas.

**Y falla en silencio por diseño:** el mismo bloque CSS le pone una transición de color a
TODOS los elementos, así que ni siquiera parpadea al aplicarse.

**⚠️ La mitad más cara fue el arreglo anterior.** Horas antes se había reportado que el chip
de «tema en prueba» saltaba en la primera pantalla de un cliente, y se tapó **el chip** con un
`display:none`. Pero el chip no era la causa: era el único **AVISO** de que había un tema de
laboratorio aplicado, y su única salida. Es «esconder el botón no protege nada», y volvió del
otro lado una hora después — esta vez sin ninguna pista de qué estaba pasando.

**La regla:** una herramienta de laboratorio que puede dejar la app inutilizable se gatea
**en el server y en positivo** (solo admin), nunca escondiendo su interfaz. El `localStorage`
lo escribe el navegador y no sabe de sesiones.

**Y la señal para la próxima:** *todo* lavado —texto, bordes, botones, a la vez— no es
hidratación ni datos: es una **paleta**. Los datos ya estaban en el header.

**Vive en:** app/layout.tsx (el guard `esAdmin`) · app/globals.css (`[data-tema-candidato]`) ·
lib/temas-candidatos.ts · tests/bienvenida.test.ts *— 16/08/2026*

## Cómo se diagnostica «la pantalla está vacía» sin perder media hora

De la corrida de arriba, el orden que **sí** cierra el caso rápido — y que no seguí:

1. **¿Están los datos?** Una query a la tabla. (Estaban: 15 tareas.)
2. **¿Los manda el server?** `curl` con la cookie de sesión y buscar un título en el HTML.
   Si el HTML los trae, **el problema es del navegador** y todo el código de servidor queda
   descartado de una.
3. **Recién ahí, el navegador**, y lo primero es la **consola de quien lo está viendo** — no
   reproducirlo en local. Reproducir un problema de `localStorage` en otra máquina es
   imposible por definición: el estado que lo causa no viaja.

Lo que hice mal: entre 2 y 3 me fui a pelear con Chrome headless y cookies de impersonación
para ver la pantalla en local, cuando el estado que causaba el bug vivía en el browser del
dueño. **Un bug que depende del navegador se pide, no se reproduce.**

*Corrida del 16/08/2026 — plan vacío de un cliente.*

---

## El recorte de 12 a 6 pasos (03/09/2026)

Cinco pasos —lead magnet, avatares, cara de marca, personalidad, matriz— eran la
**fábrica de creativos**, o sea la configuración de una tab, y se le pedían a todo
cliente nuevo antes de dejarlo entrar a nada. Se mudaron a `/ads-writer` (el Copy
Generator) y el Video Generator quedó detrás de él con un campo nuevo, `requiere`.

**Vive en:** `lib/capas.ts`, `lib/tab-onboarding-catalogo.ts`, `lib/tab-onboarding-state.ts`,
`lib/copygen-puente.ts`, `app/ads-writer/`, `app/onboarding/Listo.tsx`.

### Sacar un paso puede dejar huérfano un proceso que nadie más empujaba

**El diagnóstico obvio era el equivocado, y por eso vale la entrada.** Al sacar `retro`
del recorrido, `integraciones` quedó último. Parece cosmético. Lo que rompió es otra cosa:
`tickExtraccion()` —que trae el histórico de 365 días de Meta, leads, transcripciones,
guiones, llamadas y VSL— tenía **un solo call-site en todo el repo**: `loopTicks`, un bucle
del navegador que vive adentro de `OnboardingWizard.tsx`. O sea que el histórico avanzaba
únicamente mientras el cliente tuviera el wizard abierto, y **no se podía reanudar nunca**:
al cerrar el onboarding `status` pasa a `done`, la page deja de renderizar el wizard, y con
él desaparece el único lugar capaz de llamar al tick. `extraction.status` quedaba en
`running` para siempre, con el histórico a medias, sin error y sin síntoma.

Lo tapaba un **accidente**: el paso `retro` iba después de conectar Meta y su pantalla era
literalmente la sala de espera («todavía estoy leyendo tu histórico…», con el botón
deshabilitado hasta que `meta_metrics` terminara). Retenía al cliente el tiempo suficiente
para que al menos ese job cerrara. Los otros cinco ya quedaban huérfanos igual.

**La regla que queda.** Antes de sacar un paso de un recorrido, preguntá **qué se apoyaba
en el TIEMPO que ese paso hacía pasar**, no solo qué datos recogía. Una pantalla puede
estar sosteniendo un proceso sin que nada en el código lo diga. Y la de fondo, que ya está
en AGENTS.md: *después de escribir una salida, preguntá quién la llama* — un único
call-site, en una pantalla que por diseño deja de existir justo cuando el trabajo todavía
corre, es un proceso sin dueño. Se arregló con `app/api/cron/onboarding-extraccion` (cada
15 min, sobre los workspaces con Meta). El `leaseAt` que ya tenía `tickExtraccion` contra
dos pestañas alcanza para que el cron y el navegador convivan.

### Una migración de pasos deja PENDIENTE a quien ya los hizo, y con `requiere` eso EXPULSA

Los cinco pasos pasaron de `steps.entregable…angulos` (onboarding global) a
`cg_entregable…cg_angulos` (`onboarding.tab.ads-writer`). Estado nuevo, claves nuevas,
**cero puente**: `getEstadoTab` arranca del esqueleto, así que la tab figuraba pendiente
en el 100% de los workspaces de producción — incluidos los que la completaron hace meses.

Solo eso ya sería molesto. Con el `requiere` nuevo es una **expulsión**: un cliente que
ayer filmaba anuncios abre `/video-generator`, `onboardingRequeridoPara` lo manda a
`/ads-writer`, y ahí lo recibe un wizard de cinco pasos **que no tiene salida a propósito**
pidiéndole que vuelva a cargar lo que ya cargó.

**La regla.** Toda mudanza de claves de estado necesita su puente ANTES del guard que las
consulta, y el puente corre en **las dos puertas** (la tab que mudó y la que depende de
ella) — si no, el cliente igual se come un rebote por algo que ya tenía hecho. Vive en
`lib/copygen-puente.ts`.

Y la excepción deliberada a «estado vivo, no recordado»: acá el puente lee el **flag** del
onboarding viejo, no el dato. La pregunta no es «¿este workspace tiene avatares?» sino
«¿esta persona ya recorrió este paso?» — y un avatar sembrado por `clonar-dueno` contesta
que sí a la primera y que no a la segunda.

**Y el puente vive en un RENDER, así que solo lo ve quien abre la tab** *(16/09/2026,
api-mako-areas)*. `puentearPasosCopyGen()` corre —y ESCRIBE— en `app/ads-writer/page.tsx:22`
y `app/video-generator/page.tsx:74`, y en ningún otro lado. `getEstadoTab('ads-writer')`
pelado (`lib/tab-onboarding-state.ts:115`) no puentea. Cualquier otro lector —la API de
MaKo, WhatsApp, un cron— ve pendiente el Ads Writer de un cliente viejo que no abrió
ninguna de las dos pantallas desde la migración, y con eso el Video Generator figura
bloqueado. Hoy son tres: `estado_onboarding_contenido` y `estado_onboarding_video`, que lo
avisan en el payload (`lib/api-mako/areas/contenido.run.ts:446`, `video.run.ts:543`), y
`tabsPorConfigurar` (`lib/api-mako/areas/negocio.helpers.ts:365-374`), que lo lista «por
configurar» sin aviso. Una lectura no puede llamar al puente, porque escribe. **Sin hacer:**
correr el puente una vez por workspace fuera del render (cron o script de una vez), para
que el estado calculado no dependa de quién miró.

### Forzar un tema descubre los colores que estaban clavados

El onboarding pasó a pintarse oscuro siempre. Con eso, `--primary` sube de luminosidad
(#2F6FED → #7FA6F8) para poder leerse como texto — y el `color: '#fff'` clavado del botón
de avance quedó en **2,41:1**, por debajo hasta del 3:1 de texto grande, en el único
control de avance y en las once pantallas del recorrido.

**La regla.** Un color que existe PARA un fondo se declara al lado de ese fondo, como
`--on-sidebar` y `--on-ink`. Se agregó `--on-primary`, en las tres paletas que redefinen
`--primary`. Un `#fff` literal encima de un token es una apuesta a que ese token nunca
cambie de luminosidad.

### `TemaOscuroScript` desactivaba el cleanup de `TemaOscuro`

`TemaOscuro` decide si sacar `data-tema` al desmontarse mirando si YA estaba puesto al
montarse — para no apagarle el oscuro a quien lo eligió para toda la app. Correcto, y el
script lo rompía: como corre ANTES de la hidratación, el atributo **siempre** estaba, así
que el cleanup no sacaba nada nunca.

Fuga resultante: entrar a `/video-generator` y volver por el sidebar —navegación de
cliente, sin documento nuevo— dejaba **la app entera** en oscuro, incluido el cliente que
eligió el tema claro. Es el incidente del laboratorio de paletas por otra puerta.

**La regla.** Cuando una pieza tiene que restaurar un estado previo y otra se lo pisa antes
de que pueda leerlo, la que pisa tiene que **dejar dicho que fue ella**. El script ahora
marca `data-tema-prestado` y el cleanup cree esa marca en vez de deducirla. Arregla las
tres pantallas oscuras de una.

### Lo que quedó SIN hacer

- **El aside del onboarding (`escenario`) ya no se dibuja.** El modo `desnudo` lo ignora, y
  el prop se sigue pasando en `OnboardingWizard.tsx` a propósito, para que volver atrás sea
  borrar una línea. Si se decide que no vuelve, hay que sacar `PanelMarketing`, `FasePanel`
  y `factsDePantalla` de ese archivo.
- **Las pantallas de los 6 pasos que salieron siguen en `OnboardingWizard.tsx`** y hoy son
  inalcanzables para toda capa. No están muertas por contrato (una capa futura podría
  incluirlas), pero nadie las usa.
- **El detector de voseo no cubre `invertís`, `hablás`, `entregás`, `corregís`, `aprobás`,
  `lanzás`, `agendás`.** La primera estaba en producción, en la segunda pregunta del
  diagnóstico, con el test en verde. Vive en `tests/puente-panel-copy.test.ts`.

---

## El reset que no reseteaba, y las cuatro cosas que salieron de tirar de ese hilo

*03/09/2026 · el estado del onboarding por tab · reportado como «estoy en la cuenta
de Leandro y no me salta el onboarding apenas entre».*

### El síntoma, y por qué el diagnóstico obvio era el equivocado

Se «reseteó» el onboarding del Video Generator de un cliente borrando la fila
`app_settings` con `key='onboarding.tab.video-generator'`. La fila desapareció, se
verificó que ya no estuviera, y al entrar **la tab abrió normal**.

La causa no estaba en el gate ni en el wizard: **la pregunta «¿este paso está hecho?»
tiene la respuesta escrita en DOS claves.**

**Vive en:** `lib/tab-onboarding-state.ts:128-142`

```ts
const steps = Object.fromEntries(def.pasos.map((p) => {
  const propio = parsed.steps?.[p.key];
  if (propio?.done) return [p.key, propio];
  const at = compartidos[p.key];            // ← onboarding.tab.pasos
  return [p.key, at ? { done: true, at } : { done: false }];
}));
const todo = def.pasos.filter((p) => !p.opcional).every((p) => steps[p.key]?.done);
// El status se RECALCULA: si otra tab completó lo que faltaba, esta ya está.
```

El registro compartido `onboarding.tab.pasos` existe por una razón buena —conectar el
WhatsApp desde `/whatsapp` tiene que contar también en `/chatbot`, que es el mismo
número visto desde dos puertas— y el cruce es correcto. Lo que estaba mal era el
BORRADO, que tocaba una clave de las dos.

Medido en el ws10: la clave propia no existía y los **seis** `vg_*` seguían vivos en
el compartido, así que `getEstadoTab` recalculaba `done` y la tab abría.

**La regla:** el borrado va por la función que toca las dos (`reabrirOnboardingTab`
para la tab entera, `desmarcarPasoEnTodasLasTabs` para un paso), y se **verifica el
valor CALCULADO, no la fila escrita**. Toda la falla vive en la distancia entre las
dos, así que comprobar la fila es comprobar la mitad que no falla. Molde:
`scripts/reabrir-onboarding-tab.ts`.

⚠️ Y el respaldo también es de las dos. Guardar sólo la clave que uno está mirando es
el mismo error aplicado al respaldo, y deja restaurar con confianza.

### El mismo bug ya estaba escrito desde agosto

**Vive en:** `scripts/reset-chatbot-leila.ts:145`

Borraba los audios de una clienta, escribía `steps` sin `voz` en la clave propia, y
acto seguido imprimía **«✓ paso `voz` reabierto»**. Nunca tocó el compartido.

Lo que salva el caso concreto es que en el ws11 los pasos `ensayo` y `aprobar`
seguían pendientes en agosto, así que la tab abría igual por otro motivo y la clienta
llegó a regrabar (`voz` tiene timestamp del 12/08, dos días después del reset). O sea
que **el bug era real y la consecuencia no se materializó por casualidad** — vale
anotarlo así y no como un incidente, porque la diferencia importa al leer esto
después.

### Una migración que decide si le toca mirando el estado que ella escribe es un bucle

**Vive en:** `lib/copygen-puente.ts:62`

`puentearPasosCopyGen` corría cuando `tab.status !== 'done'`. Eso es correcto la
primera vez y falso siempre después: **«todavía no migré» y «la reabrieron a
propósito» son indistinguibles**.

Así que reabrir el Copy Generator era **imposible por diseño**: `reabrirOnboardingTab`
limpiaba las dos claves, el script verificaba el estado calculado y contestaba «✓ la
tab vuelve a abrir en su onboarding», y la primera carga de `/ads-writer` o de
`/video-generator` volvía a marcar los cinco `cg_*` desde los flags del onboarding
global. Sin ningún síntoma: el operador ya había visto su tilde.

Una migración de una sola vez deja **su propia marca** y sale temprano. Va como clave
propia y no como paso: un paso lo borraría el propio reabrir —que es justo lo que hay
que sobrevivir— y además diría algo falso, porque el cliente no recorrió ninguna
pantalla nueva. Lo que registra es un hecho del SISTEMA, no del cliente.

### El paso que cierra el onboarding lo marcaba el botón equivocado

**Vive en:** `app/video-generator/video-action.ts` — estaba en `cambiarMuletillasAction`,
va en `confirmarEscenaAction`.

El bloque tenía su comentario perfecto —«aprobar el primer escenario es la única
prueba de que toda la cadena funciona»— y estaba **dentro de la función que reescribe
el guion**. Falla en las dos direcciones:

- aprobar el escenario NO cerraba `vg_ensayo`, el último paso no-opcional, así que la
  tab **nunca** quedaba `done` y el wizard recibía a la persona en el paso 6 de 6 en
  cada carga;
- y «Formatear guion» —que sólo se ofrece mientras no hay nada filmado— sí lo cerraba,
  o sea daba la tab por probada **sin un solo cuadro generado**, que es exactamente lo
  que un ensayo existe para impedir.

**Medido en producción: tres clientes (ws1, ws11, ws14) con TODOS los demás pasos
hechos y sólo `vg_ensayo` pendiente.** Completaron el onboarding entero y la tab los
seguía recibiendo con el wizard.

⚠️ Y el `.catch(() => {})` se comía el caso real: `marcarPasoTab` se niega a cerrar un
paso si falta uno anterior, y eso deja el onboarding abierto para siempre sin que nada
lo diga. Ahora el catch registra el motivo.

### Dos pasos distintos que comparten NOMBRE se marcan solos entre sí

**Vive en:** `lib/tab-onboarding-catalogo.ts:153`

`instagram` usaba `contexto` y `ensayo` a secas — las mismas dos keys del Chat Agent.
El catálogo advierte esta trampa **cuatro veces en prosa** y `carousels` ya la había
esquivado con su prefijo; este quedó atrás.

Medido en dos clientes. En el ws11, `instagram.contexto` tiene el timestamp
`2026-08-10T20:36:51.948Z` y el `contexto` del Chat Agent `…52.603Z`: 0,6 s después.
Lo marcó `/chatbot`.

Lo caro es el segundo paso: **el ensayo de Instagram previsualiza el borrador de un
DM, y saltearlo enciende el auto-respondedor sin que nadie haya leído una sola
respuesta.**

⚠️ **Lo que faltaba no era otra advertencia: eran los TESTS.** Había tres, y los tres
de la forma «mis pasos empiezan con MI prefijo», uno por tab (`cg_`, `vg_`). Un test
así es **estructuralmente incapaz** de encontrar esta colisión, porque las dos tabs que
colisionaban no tenían ninguna regla de prefijo que romper. La pregunta correcta no es
«¿esta tab respeta su prefijo?» sino **«¿qué key aparece en más de una tab?»** —
`tests/onboarding-keys-colision.test.ts`, con lista blanca explícita, y con su inverso
(una entrada que ya no comparte nadie también falla: si no, queda permiso escrito para
una colisión futura).

### El acento guardado no tenía procedencia

**Vive en:** `app/video-generator/voz-cliente.ts`

`video.voz` guardaba el id del acento y nada más, así que **«lo eligió el cliente» y
«lo adivinó el navegador de quien estaba mirando» eran el mismo valor**, y todos los
lectores lo trataban como declarado. Es la otra mitad del incidente del 02/09 (un
cliente de Baja California con acento argentino porque la detección midió la máquina
del que verificaba).

Lo que lo vuelve caro es que después **no se puede auditar**: ni un barrido por los
diez workspaces separa los contaminados de los legítimos. El del ws1 se recuperó de
los 366 prompts ya mandados a Flow —22 decían «Spoken in Northern Mexican Spanish»— y
eso fue suerte: **el ws10 tiene tres trabajos y ninguno con ese bloque**, así que ahí
no habría nada que consultar.

Ahora `VozCliente` lleva `acentoOrigen: 'elegido' | 'sugerido-zona'`, `acentoZona` y
`acentoAt`; `setAcentoCliente` exige el origen **sin default** —con uno, el llamador
que no piensa en esto escribe «elegido» sobre una adivinanza, que es literalmente el
incidente—; la pantalla lo sabe porque marca `acentoTocado` en el `onChange` del
desplegable; y `resolverAcento` lo propaga en vez de deducirlo de la mera presencia
del valor.

⚠️ Ausente = escrito antes de que el campo existiera, o sea **desconocido**. No se
asume `elegido`: asumir es lo que produjo el incidente.

### Lo que quedó SIN hacer

- **La colisión ya escrita en los datos no se migró.** Al renombrar a `ig_contexto` /
  `ig_ensayo`, los workspaces que tenían `contexto`/`ensayo` marcados por `/chatbot`
  vuelven a ver los dos pasos de Instagram — que es lo correcto, porque nunca los
  hicieron. Lo que NO se puede saber es si alguno los hizo de verdad por Instagram, así
  que no se copió nada. Si aparece un cliente que se queja de rehacerlos, la respuesta
  es que sí los tenía que hacer.
- **`marcarPasoTab` congela en el estado propio de la tab lo que leyó del compartido**
  (se ve en el ws11: `instagram.contexto` con el timestamp exacto del compartido). No
  hace daño hoy —`getEstadoTab` recorre `def.pasos`, así que una key que ya no existe
  se ignora— y ensucia cualquier forense sobre quién marcó qué.
- **Las 9 voces huérfanas** de ElevenLabs siguen ahí (el código ya no crea más).

*Corrida del 03/09/2026 · 119 agentes en 5 dimensiones con refutación adversarial de 3
lentes · 38 hallazgos, 12 sobrevivieron, 5 bloqueaban.*


---

## El Archivero tiene una segunda puerta: un documento que otra pantalla ya leyó (15/10/2026)

Desde la decisión de Martín del 15/10 (ref `offer-archivero`: «¿El Archivero del chat guarda el archivo y
paga una extracción por documento? → A · Sí»), cada archivo que el dueño manda en el chat de Offer queda
también en El Archivero. Entra por `registrarDocumentoSinPisar` (`lib/archivero.ts`), y **cualquier otra
pantalla que quiera guardar un documento en El Archivero entra por ahí**, no copiando la ruta:

- **Es dueña del binario que recibe**: lo mueve a `<ws>/<id>` (el formato de `pathSubidoValido`) o lo borra.
  Nunca queda suelto.
- **El id sale del contenido** (`idDeContenido`: sha256 del workspace + los bytes), y el lugar se gana
  MOVIENDO el binario antes de pagar la extracción: dos envíos del mismo archivo pagan uno. Mirar si la
  fila existe no alcanza, porque la extracción tarda segundos.
- **No llama a `buildEstado(true)`** (ver «`buildEstado(true)` reescribe el brief…»): suma sólo las claves de ese documento
  (`answersConDocumento`), con lecturas estrictas antes de escribir.
- **No regenera el panorama** (sería otra llamada paga) y paga UNA extracción, anotada como «El
  Archivero» con el motivo de quien la pidió.

El detalle y lo que enseñó, en `docs/hallazgos-offer.md` → «El Archivero desde el chat (15/10/2026)».

**Vive en:** `lib/archivero.ts` (`registrarDocumentoSinPisar`, `reclamarLugar`) · `lib/archivero-registro.ts`
· `tests/offer-archivero.test.ts`

## El prototipo conversacional: cuatro trampas de escenas y animación (04/09/2026)

Salieron auditando el prototipo del onboarding-como-chat (el canvas de Claude Design), pero
**ninguna es del prototipo**: son cuatro formas de romper una interfaz por escenas, y las
cuatro aplican igual al wizard real.

### Mover un elemento en el árbol mata en silencio todo selector que lo alcanzaba

El grafo vivía adentro de cada escena; se lo sacó a una capa propia, hermana de todas. Con
eso, **las cinco reglas escritas como `.vac .bv-nodo` pasaron a acertar CERO elementos** —
el mapa ya no era descendiente de la escena. No falla, no avisa, no aparece en ningún log.

Lo que se cayó en cadena, sin que nada lo denunciara:
- El vaciado dejó de ser en cascada (polvo → áreas → pilares) y pasó a apagarse entero en un
  frame, porque la única declaración de `transition` vivía en una de las reglas muertas.
- Los `transition-delay` de 0 / 620 / 1200 ms quedaron inertes.
- El mapa **achicaba** en vez de recentrarse: con la regla muerta ganaba la de otra escena.
- Y una espera de 3040 ms presupuestada para «lo que tarda la última ola» pasó a pagar por
  una animación que ya no corría: **2,1 segundos de pantalla congelada**.

> **La regla: después de mover un elemento en el DOM, hay que ir a buscar quién lo nombraba
> por descendencia.** El CSS muerto es indistinguible del CSS que no hace falta, y su costo
> no se ve como un error sino como «la animación quedó fea».

### Un token de cancelación que sólo se renueva al empezar la tarea siguiente no cancela nada

La máquina de escribir se protegía con un token (`serie`): cada corrida guarda su número y
cada tick se muere si el número cambió. Correcto, pero **el token sólo se incrementaba al
ARRANCAR la corrida siguiente**. Entre irse de una escena y que la próxima empiece a
escribir había tres segundos en los que el typewriter viejo seguía vivo — y escribiendo su
frase adentro del nodo de la escena nueva, que además cae en el mismo lugar de la pantalla.

Se ve como *«el texto nuevo borra el anterior»*, con dos frases que no tienen nada que ver.
Medido en el DOM del nodo de la escena nueva, muestreando cada 300 ms:

```
"crecer tu ne" → "crecer tu neg" → "crecer tu nego" → "Po" → "Por"
```

> **La regla: el cambio de escena CORTA; no espera a que algo nuevo lo pise.** Y cortar una
> vez no alcanza: un timer viejo puede volver a arrancarlo después, así que todo callback
> diferido que toque la escena necesita su propia guarda (`if (this.state.escena !== 'bv')
> return`).

Corolario del mismo caso: **si el pintado busca su destino por selector global
(`querySelectorAll('[data-cola]')`), no distingue de qué escena es el nodo.** Acotarlo a la
escena montada es cinturón además de tirantes.

### El eco de una respuesta no es estado que persiste: viaja con la transición

`elegido` guardaba la respuesta elegida para mostrarla arriba de la pregunta siguiente. Lo
escribía el click en el chip y lo limpiaba únicamente el reinicio. Dos defectos:

- Aparecía **480 ms antes** de cambiar de escena, encima de la pregunta que acabás de
  contestar, empujando la columna.
- Los otros caminos de avance (la flecha de la barra, el botón «Conectar» de un widget) no
  pasaban por el chip, así que **el eco del turno anterior quedaba colgado bajo la pregunta
  nueva, atribuyéndote una respuesta que no diste**.

> **La regla: un dato que sólo tiene sentido durante una transición se pasa COMO ARGUMENTO de
> la transición** (`ir(escena, eco)`), no se deja en el estado esperando que alguien lo
> limpie. Si vive en el estado, hay que limpiarlo en todos los caminos, y siempre falta uno.

⚠️ Y al envolverlo: `siguiente: avanzar` como handler recibe el EVENTO como primer argumento.
Sin `() => avanzar()`, el objeto del evento termina impreso como si fuera la respuesta.

### Una constante escrita dos veces se desincroniza, y el síntoma aparece sólo en una franja

El alto de la banda del grafo estaba en `height:42vh; min-height:230px`, y el desplazamiento
del contenido de abajo lo repetía a mano con `top:42vh` + `@media (max-height:700px){
top:230px }`. **El cruce real de esas dos expresiones no es 700 px sino 548**, así que entre
548 y 700 px de alto de ventana las dos cajas arrancaban en alturas distintas: hasta 64 px de
superposición, con los puntos de progreso pintados adentro del grafo.

> **La regla: una sola expresión, `top: max(42vh, 230px)`.** Un breakpoint que replica a mano
> una fórmula de otra regla es una constante duplicada, y se desincroniza al primer cambio.

### Y dos que no son de código

- **Los chips y el widget se pintaban en el frame 0 del turno**, mientras la pregunta que los
  presenta tardaba hasta 7,5 s en escribirse: se puede contestar antes de leer qué te
  preguntaron. Van detrás de una bandera que se prende cuando la frase termina.
- **El botón invisible seguía siendo clickeable.** «Comenzar» está en `opacity:0` durante
  todo el revelado, encima de una pantalla cuyo copy dice «toca en cualquier lugar»: un toque
  ahí se saltea la entrada entera sin que nadie entienda por qué. `opacity:0` esconde,
  `pointer-events:none` desactiva — y hacen falta las dos.

### El signo de una acción se muestra cuando la acción empieza, no cuando se monta la pantalla

El cursor que simula la escritura estaba SIEMPRE en el markup, sin depender de nada. Se veía
parpadear en el medio de la pantalla **mientras el grafo todavía se estaba apagando**, tres
segundos antes de que se escribiera la primera letra: le anuncia al ojo que va a pasar algo
justo donde todavía está pasando otra cosa, y le roba el final a la animación anterior. Es el
mismo error que un spinner pintado antes de que salga la petición.

⚠️ Y arreglarlo con `setState` **rompe el texto**: el render que dispara se arma con el `cola`
que hay en el estado en ese momento y PISA la letra que el pintado directo acababa de escribir
en el DOM. El síntoma es sutil y fácil de no ver: el texto arranca en la segunda letra («Po»
en vez de «P»).

> **La regla: si un dato se escribe directo al DOM para evitar renders, todo lo que lo
> acompaña tiene que viajar por el mismo camino.** Mezclar los dos hace que el render pise al
> DOM, y el que pierde es siempre el que escribió sin pasar por el estado.

*Corrida del 04/09/2026 · 67 agentes en 4 lentes con refutación de 3 escépticos por hallazgo
· 21 hallazgos, 18 sobrevivieron.*


---

## Cuatro trampas más, del rediseño de la pantalla de preguntas (04/09/2026)

### `justify-content: center` recorta por arriba lo que no entra, y el síntoma culpa al contenido

La caja del diálogo centra vertical y scrollea. Cuando el contenido crece —una pregunta con
widget, o un personaje nuevo arriba— el sobrante se sale por los DOS lados y **el de arriba
queda recortado e inalcanzable**. Se vio como «el personaje aparece cortado a la mitad», y
media hora se fue midiendo el SVG: la estructura, el `transform-box`, los ejes de las elipses.
Todo estaba bien; lo que fallaba era la caja de al lado.

> **La regla: `justify-content: safe center`.** Centra mientras entra y vuelve a alinear
> arriba cuando no. Y la de diagnóstico: si un elemento se ve mal *sólo en algunas pantallas*,
> antes de medirlo por dentro hay que mirar quién lo contiene.

### Cuando algo se ve chico en un SVG, mirá la relación de aspecto antes que la escala

El encuadre automático del grafo «no funcionaba»: se aplicaba una escala de 1,695 —medida— y
el nodo seguía diminuto. El viewBox era 700×700 dentro de una caja de 900×209. Con
`preserveAspectRatio` por defecto el SVG entra por el lado que MENOS da, usaba 0,30 px por
unidad y tiraba tres cuartos del ancho. Duplicar la escala sobre eso sigue siendo chico.

> El recorte tiene que tener **la forma de su caja**. El ajuste automático no falla: obedece.

### Un valor por defecto que significa «recién nacido» desplaza todo lo que nadie registró

El motor del grafo aleja a cada nodo de su lugar al nacer y lo trae con un decaimiento, pero
sólo si alguien anotó cuándo nació su nivel — y eso lo hacía únicamente la bienvenida. En las
preguntas los nodos quedaban desplazados 260-480 unidades **para siempre**, y el encuadre
medía el `cx`/`cy` del círculo, o sea la posición donde no estaban.

> **El default de «no sé cuándo nació esto» tiene que ser EN REPOSO, no desplazado.** Un
> default que significa «en movimiento» convierte cada camino que nadie instrumentó en un
> defecto visual, y el defecto aparece lejos de su causa.

### Recortar el artefacto dentro del prompt del que lo juzga hace que juzgue la mutilación

Un panel de 3 propuestas × 3 jueces devolvió puntajes bajos y una crítica repetida: «el CSS
está truncado, no es pegable». Era cierto — pero lo había truncado **el prompt del juez**, con
un `slice(0, 2600)` puesto para ahorrar tokens. Las hojas originales estaban completas y bien
cerradas. Sin verificarlo, se habría descartado la mejor propuesta por un defecto inventado
por el arnés.

> Lo que se le pasa a un evaluador tiene que ser **el artefacto entero o nada**. Si no entra,
> se evalúa por partes; no se recorta y se pregunta si está bien.

### Una instrucción no se muestra una vez: se muestra cada vez que hace falta

«Toca en cualquier lugar» aparecía sólo en el primero de los TRES toques que arman el mapa.
Después del primero la pantalla se queda muda para siempre, y el que tocó una vez y se quedó
mirando no tiene cómo saber que faltan dos: lo que ve es una animación que terminó, no una
que espera.

> **Si el gesto se repite, la pista se re-arma después de cada paso.** El que ya entendió no
> la vuelve a ver nunca, porque toca antes de que aparezca; el que se trabó la recibe siempre.
> Y va con token: sin invalidar el reloj del paso anterior, la pista se le enciende a alguien
> que ya tocó — la misma familia de error que el typewriter escribiéndole a la escena
> siguiente.

### Un `z-index` puesto para arreglar una cosa lo pone por encima de TODAS las demás

Al mapa se le subió el z-index para que sus nodos volvieran a recibir clics. Con eso quedó
también por encima de la pista «Toca en cualquier lugar», que apareció **enterrada debajo de
los nodos**. Y encima estaba anclada al lienzo, un contenedor que termina donde empieza el pie
—que en esos pasos es invisible pero ocupa lugar—, así que caía a media pantalla, justo sobre
las etiquetas de abajo del grafo.

> Dos reglas: **un z-index no se elige contra un elemento, se elige contra la pila entera**; y
> **anclar contra un contenedor que termina antes que la pantalla pone las cosas donde no se
> ven venir** — sobre todo si lo que lo termina es un elemento invisible que igual ocupa
> espacio. La pista vive contra el borde de la pantalla, que es el único lugar que el grafo no
> ocupa nunca (medido: 159 px de aire en el paso 1, 85 px en el paso 2).

⚠️ Y el detalle que hace perder el rato al medirlo: en una pestaña oculta el grupo de un nodo
computa `opacity: 0` aunque en pantalla se vea, porque lo que lo enciende es una animación que
está congelada. Filtrar por eso descarta justo lo que se quería medir. Se mide por los
`circle`/`text` de adentro, y acotando por NIVEL a lo que ese paso revela — si no, el polvo
que todavía no nació cuenta como visible y da un choque que no existe.

### Un prototipo que muestra el resultado sin dejar hacer el gesto no se puede probar

El paso de los documentos mostraba tres archivos ya subidos, con su tilde. Se ve bien y no
sirve: lo que hay que ver funcionar antes de construirlo es justo el gesto de soltarlos.
Ahora arranca con la zona para soltar, y las opciones («Está bien, sigue», «Corregir algo»)
**no existen hasta que haya documentos** — antes aparecían ofreciendo aprobar algo que todavía
no estaba.

> Si el prototipo tiene un estado final bonito y ningún camino para llegar a él, lo que se
> está mostrando es la pantalla, no la interacción.

### `overflow:hidden` recorta en la caja de PADDING: reservar aire no impide pintar ahí

Se le dio `padding-top` a la banda del mapa para dejarle lugar al contador de preguntas. No
alcanza: el padding reserva espacio para el CONTENIDO, pero `overflow:hidden` recorta en el
borde exterior del padding, así que el SVG con `overflow:visible` seguía pintando encima del
contador. Lo que sí lo resuelve es la **máscara**, que además desvanece en vez de cortar.

### Cuando la geometría no da, el ajuste no es el margen: es aceptar que no entra

El grafo es radial —tan alto como ancho— y la banda es 2:1. El alto manda siempre y el ancho
sobra, así que meter las 16 piezas adentro deja los nodos de 5 px y los nombres ilegibles.
Se probaron dos rondas de márgenes y no movió la aguja, porque el problema no eran los
márgenes.

> **Un piso de escala, y cuando el piso gana el encuadre sigue al último nodo que nació.** Lo
> que se va por los bordes se va donde la banda ya se desvanece, así que se lee como que el
> mapa continúa y no como que se cortó. Un mapa ilegible completo vale menos que un pedazo
> legible.

⚠️ Y al animar un SVG: **rotar un grupo rota todo lo que tiene adentro.** El giro de 90° del
rombo se veía bien hasta notar que el grupo también contiene los ojos y los dejaba de costado.
El giro va en la pieza simétrica (el cuerpo); los ojos ni se enteran.

### El ORDEN de los pasos es una afirmación, y se contradecía a sí mismo

El paso «Lo que sigue no te lo pregunto: ya lo estoy viendo» —con el gasto de los últimos 30
días leído de la cuenta de Meta— era el **segundo**. Conectar Meta era el **cuarto**. O sea
que el recorrido mostraba un dato dos pasos antes de que existiera la cuenta de donde sale.

De dónde salió el error, que es lo que importa: ese paso estaba diseñado como **variante** del
diagnóstico —«el 2b reemplaza al 2 cuando Meta ya está conectada»— y al armar el recorrido
lineal se metió como un paso más. **Una alternativa convertida en secuencia miente sobre lo
que ya pasó**, y la mentira no se ve leyendo el código: se ve recorriéndolo.

> **Un paso que muestra un dato va después del paso que lo consigue. Y si ese paso se puede
> saltear, el que muestra el dato NO EXISTE.** Ahora saltear Meta saltea también la pantalla
> que la enseña, y el mapa queda con 14 piezas en vez de 16 — la consecuencia es visible, que
> es lo que convierte «saltear» en una decisión y no en un atajo gratis.

⚠️ Y el contador tuvo que dejar de contar por índice: con un paso salteable, sumar «todo lo
anterior a donde estoy» afirma piezas que nunca nacieron. Cuenta lo VISITADO, y volver atrás
trunca esa lista — así sirve igual para ir y para volver, sin contar dos veces.

Se verifica sin navegador, que además es más determinista: un script lee ESCENAS y SUMA **del
componente emitido** y recorre las dos ramas comprobando que ningún paso muestre un dato que
no se consiguió (`scratchpad/dc/probar-orden.mjs`). Una regla de secuencia se prueba mejor
simulándola que mirándola.

### Un prototipo de un flujo hay que escribirlo LEYENDO el flujo, no recordándolo

El prototipo conversacional se armó de memoria y tenía **5 turnos con una sola pregunta de
diagnóstico**. El onboarding real tiene **28**. Lo dijo Martín antes que ninguna herramienta:
«no estás revisando todo lo que hace cada paso… y estoy seguro de que te estás salteando
cosas».

Lo que faltaba, medido contra el código:

| Lo que el wizard hace | Lo que el prototipo tenía |
|---|---|
| 6 preguntas de quiz + 1 de canal que **cambia el enunciado y los tramos de la siguiente** | 1 pregunta |
| Pantalla de resultado con fase, síntomas, Norte, funnel sugerido, pauta, qué hacer y qué no | nada |
| Paso entero de la llave de IA — sin ella el Archivero no lee nada | no existía |
| Devolución del Archivero: **una tarjeta por documento con el razonamiento de la IA**, y el panorama en 6 secciones | tres chips estáticos |
| Preguntas generadas para los **huecos** que ningún documento resolvió (hasta 11) | nada |
| Catálogo de productos, email, WhatsApp + código de 6 dígitos | nada |
| Cascada de Meta: token, descubrimiento, elegir cuenta | un botón «Conectar» |

> **Lo que se recuerda de un flujo es su forma; lo que se saltea es justo el contenido que
> hace que cada paso valga.** Un paso que pregunta y no devuelve nada convierte el chat en un
> formulario con globos — y ése era exactamente el reparo.

Tres cosas que el traspaso enseñó, y que no son del prototipo:

- **La espera es un turno, no un spinner.** «Estoy leyendo tus documentos» merece pantalla:
  el trabajo de MaKo es la mitad del valor, y esconderlo detrás de un cargando lo regala.
- **Un turno que depende de algo que no pasó no se muestra vacío: no se muestra.** Se modeló
  como un predicado por turno (`si`) en vez de un `if` cableado a un caso; saltear Meta ahora
  omite tres turnos y deja 14 piezas de 16, y saltear la verificación omite el código.
- **Lo que hay que contestar no puede depender de scrollear.** Con una devolución larga —tres
  documentos con su razonamiento— las opciones quedaban abajo del scroll. Viven fuera de la
  caja que scrollea, y el contenido se desvanece contra ellas.

⚠️ Y una de medición: **mantener apretado acelera la escritura 3,6×** (4730 ms → 1305 ms para
la misma frase de 40 letras), pero eso sólo se pudo medir con la ventana VISIBLE. Ver
[[verificar-en-navegador]]: en la pestaña oculta cualquier número de tiempo es el del
estrangulamiento, no el del código.

### Lo que se rompe al renombrar un flujo entero, y cómo se atrapa

Reescribir los 28 turnos y renombrar todas las escenas dejó **10 regresiones confirmadas** (16
halladas, 6 refutadas). Casi todas son la misma familia: **una referencia que nadie actualiza
porque no está escrita como referencia, sino como texto.**

- **El nombre de escena escrito a mano.** `presentarse()` hacía `ir('diagnostico')`, una escena
  que el renombre borró: `TURNOS['diagnostico']` quedaba `undefined` y el primer turno se
  dibujaba VACÍO — sin pregunta, sin opciones y sin widget. Ahora deriva del recorrido
  (`ESCENAS[0]`). **Lo que se puede derivar del recorrido no se escribe aparte.**

- **El estado inicial escrito DOS veces** —el constructor y `reiniciar()`— y las banderas
  nuevas sólo entraron en uno. `canal` y `wa` sobrevivían al «Volver a empezar», así que la
  segunda vuelta arrastraba decisiones de la primera **en silencio**: quien postergó la
  verificación de WhatsApp no volvía a ver nunca el turno del código. Una lista que hay que
  mantener en dos lugares se desincroniza; no es una posibilidad, es cuestión de cuándo.

- **Una salida que no escribe su propia bandera.** «Seguir sin Meta por ahora» prometía saltear
  tres pantallas y no salteaba ninguna: nunca ponía `meta = false`. Su gemelo de WhatsApp sí lo
  hacía, y esa asimetría entre dos cosas que se ven iguales es justo lo que nadie revisa.

- **Citarle al usuario una respuesta que nadie guardó.** «Me dijiste $20 – $100 por día» era
  texto fijo: si había contestado otra cosa, MaKo le atribuía una respuesta que no dio. Es el
  mismo pecado que obligó a reordenar todo el paso de Meta — afirmar algo que no pasó.

- **La cámara persiguiendo un nodo que se acaba de apagar.** Al volver atrás, `ultimoNodo`
  seguía apuntando al nodo recién apagado y el encuadre se iba a un pedazo vacío de la banda.

#### El invariante que ahora lo atrapa solo

Un nodo del grafo **no puede nacer de un padre apagado**: la rama se dibuja desde un punto
vacío y, como el nodo viaja desde su padre, se lo ve salir volando de la nada. Pasó porque
`a-voz` cuelga de `p-mensaje`, y a `p-mensaje` sólo lo encendía un turno **salteable**.

`scratchpad/dc/probar-grafo.mjs` lee el componente EMITIDO y el SVG del grafo, deduce qué
turnos tienen `si:` y prueba **todas las combinaciones** de saltear/no saltear. Dos cosas que
lo hacen valer:

1. **Se comprobó que falla contra el build anterior**, señalando exactamente el defecto
   reportado. Una prueba que nunca se vio fallar no prueba nada.
2. La primera versión daba un **falso positivo**: detectaba `si:` en «los 400 caracteres
   siguientes» al turno, y encontraba el del turno de al lado — acusaba de rota una rama que no
   existía. Un detector con ventana fija sobre código estructurado miente; hay que recortar el
   bloque de verdad.


*Rediseño del 04/09/2026 · panel de 24 agentes (3 propuestas × 3 jueces por problema).*

## Una función de tres líneas exportada de un `use client` tiró /onboarding ENTERO (29/09/2026)

Síntoma, en producción y reportado con captura: **«Esta pantalla se rompió al dibujarse»** en
`/onboarding`, con un digest (`1403595480`) y sin nombrar ni el archivo ni la línea.

La causa: `tabDeUrl` —tres líneas, agregadas el día anterior para que el hub leyera su tab de
`?tab=`— vivía exportada desde `OnboardingTabs.tsx`, que lleva `'use client'`, y la llamaba el
`page.tsx`, que es **server**. Para el grafo del server, un export de un módulo de cliente no es
lo que dice ser: es una **referencia de cliente**. No falla al importar. Falla al **usarlo**.

⚠️ **La regla ya estaba escrita en AGENTS.md desde el 30/08**, con su propio caso de una hora de
producción sirviendo el deploy viejo («lo que NO LLEGA al server»). Se volvió a pisar igual, y eso
es el dato: una regla en un documento no es un control. Lo que faltaba era el guard.

**Por qué no lo cazó ninguna de las tres redes que ya existen**, que es lo que hay que arreglar
además del bug — y cada una miró para otro lado por una razón distinta:

| Red | Por qué dio verde |
|---|---|
| `npm run typecheck` | **`tsx` IGNORA la directiva.** Para el compilador es una función normal, perfectamente tipada |
| `npm test` | los guards de la casa leen los fuentes como **TEXTO**: ninguno resuelve imports |
| la verificación en el navegador | esa tanda abrió `/crm`, que era lo que se estaba cambiando. `/onboarding` se tocó **de refilón** |

⚠️ **Y `npm run build` TAMPOCO lo caza**, contra lo que dice la intuición: el build terminó en 0 las
dos veces. El caso del 30/08 —el catálogo de cursos importando de un `.tsx`— sí lo tiraba, porque
ahí el valor se usaba **en tiempo de build** (al recolectar la configuración de una ruta). Acá el
valor se usa **en tiempo de request**, así que el build compila feliz y la pantalla revienta en
producción. Son dos síntomas de la misma frontera y sólo uno tiene al build como red.

**La cura estructural:** el valor se muda a un `.ts` **sin `'use client'` ni `server-only`**, que es el
único tipo de módulo que los dos lados pueden importar (`app/onboarding/tabs-catalogo.ts`).

**Y el guard**, que es la mitad que importa: `tests/frontera-use-client.test.ts` barre
`git ls-files app lib components` y falla si un módulo del server importa un **valor** de un
`'use client'` — más su espejo, si un `'use client'` importa un valor de un módulo `server-only`.

Tres cosas que lo hacen funcionar y que costaron una vuelta cada una:

- **Lo que SÍ se puede tiene que seguir pasando.** Un server component importa COMPONENTES de
  cliente y los monta: es el patrón de todo el repo. Se distinguen por la convención de nombres de
  React —PascalCase es un componente, camelCase no— que este repo cumple sin excepción. El guard
  persigue el import de un nombre **que no empieza con mayúscula**.
- **`import type` queda afuera**, y también el `{ type Foo }` adentro de las llaves: un tipo se
  borra en compilación, así que cruzar la frontera con uno no cuesta nada.
- ⚠️ **Y LOS COMENTARIOS SE SACAN ANTES DE PARSEAR.** La cláusula de un import se captura con
  `[^;]*?` y en TypeScript el `;` **no es obligatorio**: con un párrafo de comentarios entre dos
  imports, el match arranca en el de arriba y se come el texto entero. El guard reportó dos falsos
  positivos cuyo «nombre importado» era la prosa del comentario, palabra por palabra. Y el orden
  es el de siempre: los de línea **antes** que los de bloque.

Probado rompiéndolo (3 pasan / 0 fallan con todo puesto, y cada rotura da 2/1): la page vuelve a
importar `tabDeUrl` del componente —**el bug real**—, un `'use client'` importa un valor de un
`server-only`, y el parser deja de limpiar comentarios.

**Vive en:** `app/onboarding/tabs-catalogo.ts` · `app/onboarding/page.tsx` ·
`tests/frontera-use-client.test.ts` · *2026-09-29 crm-etapas-popup*

## El onboarding de /chatbot se comía el primer clic de la tab (05/10/2026)

**Vive en:** `app/automations/ChatAgentApp.tsx` · `app/automations/OnboardingChatAgent.tsx` ·
`lib/tab-onboarding-catalogo.ts`

Tarjeta #833. Ese onboarding se escribió cuando `/chatbot` era una pantalla que **presentaba**
el editor: lo primero que hacía era preguntar «¿querés el recorrido guiado o lo configuro
solo?» (`ElegirRecorrido`) y después encadenaba siete pasos. Hoy la tab **ES** la grilla de
secuencias con su lienzo, así que esa pregunta se come el primer clic de todo el mundo para
ofrecer un tour de una pantalla que ya está a la vista.

Qué pasó con cada paso viejo, que es la parte que no se deduce del diff:

| Paso | Dónde quedó |
|---|---|
| `wa_no_oficial` (vincular el número) | **es la pantalla de entrada**: si no hay WhatsApp, la tab muestra el QR inline de `EvolutionConnect` y una línea de texto |
| `wa_oficial`, `wa_oficial_num`, `wa_oficial_plantilla` | se fueron con la tarjeta #832: el canal oficial no se ofrece más |
| `contexto` (el contexto del negocio) | ya vive en su propia tab, y compartía la clave con Instagram (ver la colisión más arriba) |
| `ensayo` (previsualizar un borrador) | el simulador está adentro del editor, en el lienzo |
| **`guia_voz` («Tu forma de escribir»)** | **NO era obsoleto y no tenía otra casa** |

La guía de voz es el único que seguía haciendo falta: sin ella la IA escribe con una voz que
nadie eligió. Y la decisión de Martín fue que **no va en la puerta**: *«sería bueno que ese
tutorial se habilite la primera vez que se intente poner una tarjeta de chat y activar la
opción de "IA", entonces ahí viene ese paso»*. Queda anotado en el encabezado de
`OnboardingChatAgent.tsx` y pendiente de que exista ese interruptor en el nodo del mensaje.

**La regla que queda:** cuando una tab deja de PRESENTAR una herramienta y pasa a SER la
herramienta, su onboarding deja de ser un wizard y se convierte en su **estado vacío** —una
pantalla, lo que falta, y el control que lo arregla ahí mismo. Lo que no se puede hacer es
dejar el wizard adelante: una pregunta antes del contenido es fricción para el 100% de las
visitas, incluidas todas las que vienen después de la primera.

⚠️ **Y el componente no se borra con la ruta que lo montaba.** `OnboardingChatAgent.tsx`
sigue vivo porque lo montan `app/whatsapp/OnboardingCanalWhatsApp.tsx` y
`app/email/OnboardingCanalEmail.tsx`. Next hace ruta de un `page.tsx`, no de lo que ese
`page.tsx` importaba: antes de borrar un componente de esa carpeta, `grep` de quién más lo
importa. Su encabezado ahora dice quién lo monta y quién no.

## «Tu forma de escribir» volvió, sólo, y el wizard recortado a un paso disparaba el del QR (06/10/2026)

**Vive en:** `app/automations/OnboardingChatAgent.tsx` (`soloPaso`) · `lib/tab-onboarding-catalogo.ts`
(`setting`) · `app/automations/SecuenciaPerfil.tsx` (`setModoIA`)

La entrada del 05/10 dejaba la guía de voz sin pantalla hasta que existiera el interruptor de IA.
Ya existe: tildar «Lo adapta MaKo» en una tarjeta de chat pregunta al server si el paso
`contexto` está hecho y, si no, abre SÓLO ese paso del wizard, encima del lienzo.

- **El paso vuelve al catálogo `setting` como OPCIONAL.** Tiene que estar en la lista —sin la
  key, `marcarPasoTab` la rechaza y el paso no se puede cerrar nunca— y no puede ser obligatorio:
  la tab volvería a pedir onboarding a todo el que ya la tenía lista. Con `opcional`, el `status`
  no lo cuenta (medido en el ws1: sigue `done`, con su guía del 02/08).
- **«Primera vez» se pregunta al server en el momento**, no se guarda en el navegador: la guía
  puede haberse armado desde otra pestaña o desde otro usuario del mismo negocio. Si la pregunta
  falla, no se abre nada — la IA escribe igual, con un registro neutro.
- **Con `soloPaso` el WizardShell deja de ser `embebido`** (pasa al overlay fijo) y se portalea al
  `body`: adentro del lienzo, un `position: fixed` nace recortado por los contenedores de arriba.
- **Y con el tutorial encima se apaga la pila de deshacer del lienzo.** Si no, un Ctrl+Z fuera de
  un campo de texto deshacía el lienzo de atrás, y lo primero que deshacía era la casilla.

⚠️ **Lo que cazó el navegador: un wizard RECORTADO hereda los efectos del paso por default
mientras carga.** `pasoKey` caía a `'wa_no_oficial'` mientras `def` no llegaba, y el efecto de
ese paso corre en la primera pasada: abrir «Tu forma de escribir» mandaba un `POST
/api/whatsapp/evolution` (`action: 'estado'`) para un paso que esa pantalla nunca iba a mostrar.
El default es `soloPaso` cuando lo hay. **Lo encontró el arnés porque ABORTABA toda request que
no fuera GET** y las listaba: una verificación que sólo mira la pantalla no lo ve, porque la
pantalla se dibuja perfecta.

## La depuración del proyecto del tablero (10/10/2026)

**Vive en:** `app/admin/runway/datos.ts` (`ONB_VEREDICTOS`) · `app/admin/runway/page.tsx`
(`TablaVeredictos`) · el proyecto «Feature: Onboarding» (`arranque-del-cliente`, ws9)

Pedido de Martín: revisar el proyecto con el criterio de la casa, repriorizar o borrar lo
innecesario, y dejarlo en Runway. De 20 abiertas: **5 se quedan** (#734, #171, #737, #801,
#201), **10 se posponen**, **4 se cerraron** con su prueba en el historial (#372, #309, #706,
#707) y **1 se borró** (#625). Cada veredicto, con su motivo, en `/admin/runway#onboarding`.
El respaldo de las 20 filas y del proyecto, antes de tocar nada:
`dashboard-marketing-main/backups/onboarding-depuracion-2026-10-10.json` (fuera del repo).

El criterio: la etapa 3 del plan vigente («Onboarding + el video», que vencía el 9/10), la
poda del 03/10 (P2 y P4 eliminados) y la pregunta de Leila, «¿es indispensable para que el
negocio esté corriendo?».

### El «Qué falta» del proyecto nombraba tarjetas que ya eran de otro

El detalle del proyecto lo escribió el Perro una vez y nadie lo volvió a leer: su «Qué falta»
listaba #33, #34 y #35 (los tableros del funnel, ya en el CRM), #5 (cerrada) y #6 (en el CRM).
**Mover una tarjeta de proyecto no toca el detalle del proyecto que la nombra**, así que el
documento que alguien abre para saber qué falta mentía sobre cinco de sus siete renglones.
Se reescribió con las cinco que quedan. La regla: al mover o cerrar tarjetas en lote, se
relee el detalle de cada proyecto que las nombra, en la misma pasada.

### Cuatro tarjetas eran para la versión gratis, y se posponen: no se borran

#614 (el diagnóstico por WhatsApp con PDF), #652 (el arranque mínimo de tres pasos), #607 (el
video de bienvenida) y #608 (el grafo en vivo) nacieron para que un usuario gratis quiera
pagar. La versión gratis se postergó al «VSL Funnel 2.0», no se descartó. Borrarlas habría
mezclado DESCARTADO con POSTERGADO, que es justo como vuelve después el trabajo que se sacó.

### #734: la red de plataforma existe, y no cubre el onboarding

El diagnóstico obvio —«el onboarding está roto por la cuota de Gemini» (01/10)— está a medias.
Desde agosto se arreglaron dos cosas: `errorDeCascada` dice de quién es el fallo y una
saturación cae a otro modelo del mismo proveedor (`chatCheapCascade`). Lo que falta es la RED
DE PLATAFORMA: medido el 10/10, `provsGratisDePlataforma()` tiene tres llamadores (el audio en
`lib/ai-cheap.ts`, el doer en `lib/mako-doer-in.ts` y `app/api/chat-agent/redactar`), y
ninguno es del arranque. El Archivero lee con `leerDocumentoIA` y los productos con
`chatCheapCascade` sobre `CASCADA_DOCS`, las dos sólo con las keys del cliente. Y
`ProductosView.tsx:242` sigue pintando el error sin el botón para sumar otra key.

**Cerrada el 13/10 (`26b8eabe`) y verificada el 15/10 (`fa6a2ac3`).** Al correr las siete roturas
de `tests/onboarding-red-plataforma.test.ts`, una no la cazaba: «`chatCheap` deja de pasar
`wsKey`» daba 8 de 8 en verde. El assert buscaba
`const p = await proveedor(opts.provider, opts.clave, opts.wsKey);` en `lib/ai-cheap.ts` entero,
y esa línea está DOS veces: en `chatCheap` y en `chatCheapTools`. Romper la de `chatCheap` dejaba
viva la otra, y el test seguía en verde. Es la regla de AGENTS.md («un guard que lee el archivo
entero encuentra lo que el archivo dice de sí»), pagada otra vez. Ahora el assert mira el cuerpo
de la función (`bloque(AI, 'chatCheap(')`). Si una línea aparece dos veces en un archivo, un
assert sobre el archivo entero no puede distinguir cuál se rompió.

### Lo que quedó SIN hacer

- **Las cinco que se quedan**, sin fecha (la etapa vencía el 9/10). #171 es una línea:
  `lib/onboarding-extract.ts:67` sigue leyendo `getSetting('meta_page_id')`, que no escribe
  nadie, en vez de `credWs('META_PAGE_ID')`.
- **La verificación de la tab /whatsapp verifica la línea de MaKo, no la del cliente.** Se
  cerró #309 porque su «listo» ya pasó y porque el QR mide la línea en vivo, pero el paso
  `wa_no_oficial_prueba` (`app/api/chat-agent/onboarding/prueba/route.ts`) sigue mandando el
  código por `enviarAlGrupoMaKo`. Si alguien vuelve a confiar en ese paso como «la línea del
  cliente manda», se equivoca.
- **Las prioridades nuevas duran hasta que alguien crea, borra o completa una tarjeta con
  /plan abierto**: ahí el Perro re-puntúa el tablero entero (ver `docs/hallazgos-plan.md`, la
  entrada del 10/10). No se fijaron a mano, a propósito.

*Corrida del 10/10/2026 · chat «Onboarding», sin subagentes · medido contra el código y la base.*

## El prototipo conversacional contra el flujo REAL, y lo que eso encontró del wizard (13/10/2026)

**Vive en:** `app/onboarding/FaseUI.tsx:121` (el checklist) · `app/onboarding/OnboardingWizard.tsx:629`
(la pregunta de canal) · el prototipo y sus pruebas, FUERA del repo (ver `docs/relevo/onboarding.md`,
la ventana del 13/10)

El prototipo del onboarding-como-chat se reescribió leyendo el wizard —pasó de 5 turnos a 28— y lo
que importa acá no es el prototipo: es que **escribir el flujo real paso por paso encontró cosas del
wizard que nadie había mirado**. Las tres que se verificaron una por una contra el código:

### El checklist «Qué hacer ahora» del diagnóstico no se guarda en ningún lado

`app/onboarding/FaseUI.tsx:121` es `useState<Set<number>>(() => new Set([0]))`: se tilda (`:122`),
se dibuja (`:191`) y se pierde al recargar. No hay endpoint ni setting que lo reciba — medido con
un barrido de `app/api/onboarding/` y de `lib/fase-store.ts`: cero escrituras.

Lo que eso cuesta no es el tilde: **es que la persona le declara a MaKo lo que ya hizo y MaKo no se
entera.** El paso siguiente del arranque, el plan que escribe `lib/todo-seed-ia.ts` y el diagnóstico
de fase siguen creyendo que no hizo nada. Y la forma de falla es la de siempre: no hay error, el
tilde se dibuja, y al volver la pantalla está igual que antes — indistinguible de «no guardé».

### La pregunta de canal se puede pasar sin tocarla, y su default dispara efectos

`OnboardingWizard.tsx:629` excluye `fase:canal` de `esFaseQuiz` **a propósito** (el comentario está
en `:429`), y el default viene marcado. O sea que se puede avanzar sin elegir y queda `llamadas`.
Eso no es cosmético: ese valor decide el enunciado y los tramos de la pregunta siguiente **y siembra
la plantilla de funnel de ese canal**. La exclusión está decidida y comentada; lo que no está
decidido es que un efecto lateral de esa magnitud corra con un default que nadie tocó.

### ⚠️ Dos de los tres «defectos» que marcó la corrida eran decisiones YA comentadas en el código

Y es el hallazgo más caro de la tanda, porque los tres se leían igual de convincentes:

| Lo que marcó | Qué era |
|---|---|
| `FasePanel` se pasa y no se dibuja | **Decidido**: `OnboardingWizard.tsx:792` lo dice textual, «SE SIGUE PASANDO Y EN MODO desnudo NO SE DIBUJA. Queda a propósito» |
| La pregunta de canal no es obligatoria | **Decidido**: la exclusión de `esFaseQuiz` está comentada en `:429` |
| El checklist no persiste | **Defecto real**, el de arriba |

Se verificaron una por una ANTES de escribir acá. Sin ese paso, dos de los tres hallazgos hubieran
mandado a alguien a deshacer algo que estaba decidido — y el comentario que lo explica está en la
línea de al lado, así que el que lo deshaga tampoco iba a entender por qué «faltaba».

### ⚠️ Y el directorio de una corrida puede existir VACÍO: listarlo no es tener el journal

Para recuperar la evidencia de esa auditoría se fue a buscar los transcripts de los subagentes, que
AGENTS.md promete en disco. Medido el 13/10 en este proyecto:

- los **26** directorios de workflow de esta sesión existen y están **vacíos**, los 26 con la MISMA
  fecha (9/10 00:37) — alguien los barrió en una sola pasada y dejó las carpetas;
- las de otras sesiones están intactas: **179** `journal.jsonl` y **2151** `agent-*.jsonl` vivos,
  con contenido (uno de 287 KB del 12/10).

O sea que la retención no es global y **el directorio sobrevive al contenido**: un `ls` contesta que
la corrida existió, que es exactamente la respuesta que apaga la búsqueda.

⚠️ **Y el primer diagnóstico de esto fue el equivocado, en el alcance.** Un `find` de
`journal.jsonl` había devuelto cero y de ahí salió «ya se limpiaron todas»: estaba corriendo sobre
`<sesión>/workflows/`, y los journals viven en `<sesión>/subagents/workflows/`. Las dos rutas
existen, las dos se llaman `workflows`, y la equivocada contesta cero sin error. Es «un cero
perfectamente correcto sobre la pregunta equivocada» con las dos carpetas a la vista. Si esa
conclusión se hubiera escrito, el repo quedaba afirmando que el entorno borra los transcripts de
todos.

**La regla que queda:** la cosecha se escribe en la MISMA ventana en que se corrieron los agentes.
Un directorio de corrida no es evidencia de que la evidencia esté, y recuperarla cuatro días
después puede no ser una opción.

### Lo que quedó SIN hacer

- **Persistir el checklist de `FaseUI.tsx:121`.** Es el único defecto real de los tres y no se tocó:
  esta ventana no escribió una línea de producción.
- **Decidir si la pregunta de canal puede avanzar con el default**, que es una decisión de Martín, no
  un arreglo.
- Las cinco tareas ALTA de la depuración del 10/10 (#734, #171, #737, #801, #201) siguen sin fecha y
  sin empezar.

*Ventana del 13/10/2026 · chat de Claude Design (cuenta claude2) · el prototipo vive en el canvas y
en el scratchpad; cada hallazgo de producción se verificó contra el código antes de escribirlo.*

## ¿Se puede sacar el hub de /onboarding? Las diez secciones, medidas (15/10/2026)

Pedido de Martín (14/10/2026), textual: «Y revisa si ya podemos eliminar por completo la tab de onboarding
porque esos datos ya viven en otros lados. Creo que algunos si, como en la nueva funcionalidad "offer", pero
otros aún no». Es un RELEVAMIENTO: no se borró nada.

**El diagnóstico obvio era el equivocado.** Se esperaba que unas secciones ya tuvieran otro hogar (Offer) y
otras no. Las diez lo tienen, y es el MISMO: `/second-brain` monta las diez vistas del hub, los mismos
componentes con las mismas rutas (`app/second-brain/AreasHub.tsx` → `vistasDe`), más Panorama, Cliente,
Productos, la oferta como entidad y el funnel. Medido en prod: los 12 negocios activos están en la capa
`completo` o `agencia`, que ven Second Brain (sólo ws5, `pm` y pausado, no lo ve).

| Sección | Qué captura | Quién lo lee (fuera del onboarding) | Otra pantalla que lo captura HOY | Veredicto |
|---|---|---|---|---|
| Matriz | los guiones de cada celda avatar × razón y su estado | Video Generator, MaKo, la API (10 lectores, los de razones) | Second Brain → Razones → Matriz · Ads Writer (`AdsWriterApp` monta `MatrizView`) | **SE VA** |
| Diagnóstico | la fase del negocio (6 preguntas y el canal) | CRM, Objectives, Automations, MaKo… (14) | Second Brain → Norte · el chat de Offer, si no había uno (`guardarFaseSiNoHay`) · el wizard (paso `fase`) | **SE VA** |
| El Archivero | documentos y webs → los campos del perfil | casi todo, vía `perfilNegocioTexto`/`getAnswers` (42) | Second Brain → Documentos · el wizard (paso `archivero`) | **SE VA** |
| Oferta | las respuestas del brief: a qué se dedica y la oferta | Offer, ofertas, contexto de MaKo (5 + los del brief) | Second Brain → Oferta (la entidad Y el brief, el mismo `CamposNegocio`) · Offer crea la fila de `ofertas` | **SE VA** |
| Lead Magnet | los lead magnets | Automations, Crear con IA, MaKo (11) | Second Brain → Lead Magnet · el onboarding de Ads Writer · Automations (`setEntregables`) | **SE VA** |
| Persona | fotos y descripción de la cara de los anuncios | Video Generator, video-planner (7) | Second Brain → Voz → Persona · onboarding de Ads Writer · onboarding de Video Generator (`ElegirFoto`) | **SE VA** |
| Personalidad | las respuestas de la personalidad de voz | los guiones (`lib/razones.ts`) y el contexto de MaKo | Second Brain → Voz → Personalidad · onboarding de Ads Writer · MaKo por chat | **SE VA** |
| Avatares | los avatares del negocio | Ads Writer, Ads Analyst, Automations… (18) | Second Brain → Avatares · Ads Writer (onboarding y app) · Ads Analyst | **SE VA** |
| Razones | las razones de compra por avatar | Video Generator, MaKo, la API (10) | Second Brain → Razones · Ads Writer (`/api/onboarding/razones`) · Video Generator (cargar guiones) | **SE VA** |
| Ángulos | la recomendación de formatos que arma MaKo (el cliente no escribe nada: regenera) | **NADIE la usa para producir**: sólo la dibujan el grafo de Second Brain y la devuelve la API | Second Brain → Razones → Ángulos | **SE VA**, y es la que NADIE LEE |

⚠️ **Ángulos es trabajo a cambio de nada.** `elegirAngulo` (lib/angulos-formatos.ts), que es lo que elige el
formato de cada guion, elige de la biblioteca ENTERA y no mira `getRecomendaciones`: lo dice su propio
comentario («a diferencia de recomendarFormatos»). Cada «regenerar» paga IA para una lista que ningún
generador consulta. Sacarla también de Second Brain es otra decisión. → **Decidido y hecho el 23/10/2026**: ver «Ángulos: la
recomendación de formatos se sacó», al final.

**Lo que NO se puede borrar con el hub**, y por qué:
- **La ruta `/onboarding`**: ahí vive el wizard del primer ingreso. Lo mandan `lib/tab-access.ts` y
  `app/inicio/page.tsx` mientras el onboarding esté pendiente. Lo que se va es la rama del hub en
  `app/onboarding/page.tsx` (la que dibuja `OnboardingTabs` cuando ya está `done`).
- **Las vistas de `app/onboarding/*View.tsx`, `Archivero.tsx` y `CamposNegocio.tsx`**: las importan Second Brain
  y Ads Writer.
- **`/api/onboarding/*`**: las usan Ads Writer, Video Generator, Second Brain, Automations y la API de MaKo.
- **16 links a `/onboarding` que hoy caen en el hub** tienen que ir a la sección de Second Brain que corresponda (se revisan de a uno: alguno puede querer el wizard): Carousels, Reels,
  Stories, Video Generator («Onboarding → Persona»), Método, `/m/configurar` (y su respaldo en
  `lib/movil-rutas.ts`), `ConfigTabs`, `PanelAgencia`, `lib/mako-capacidades.ts` («Fábrica de creativos»),
  `lib/api-mako/tipos.ts` (el área negocio) y el ítem `onboarding` de `USER_NAV` en `app/_components/nav.ts`.

*15/10/2026 · chat «Offer» (cuenta claude1) · medido con grep sobre `app/` y `lib/` y una consulta a
`workspaces` en prod; no se miró en el navegador.*

### Ejecutado el 15/10/2026 (`a40182e`): el hub se fue, y lo que enseñó

Martín aprobó la tabla: «Si, ponlo en second brain… varias cosas de allí irán a sus propias tabs, como la de
Writer y la de Avatar con IA». Lo que no se deduce del commit:

- **Second Brain es el lugar de HOY, no el final.** Por eso ningún link escribe `/second-brain?area=…`:
  pide la sección (`rutaSeccion`, `lugarSeccion`, lib/secciones-negocio.ts) y una sola tabla dice dónde vive.
  Cuando Persona se mude a «Avatar con IA» o la Matriz a «Writer», se cambia su fila. `candidata` anota a qué
  tab PARECE que va cada una: Martín no dijo cuáles, es una suposición.
- **Los links viejos nunca llevaban a donde decían.** El hub abría en «Matriz» cuando no había `?tab=`, y
  los «Complétalo aquí» de Carousels, Reels, Stories, el anuncio del Video Generator y Método prometían
  completar el PERFIL: aterrizaban en la matriz de guiones. Ahora van a Documentos, que es donde MaKo pregunta
  los huecos del perfil de a uno.
- **Una sub-pestaña de Second Brain no se podía pedir por URL**: `?area=` abría el área en su primera vista.
  Ahora `?vista=` la elige, validada contra `SUBVISTAS`. ⚠️ El reset de la sub-pestaña corre también al montar:
  sin la guarda de la «área de entrada», pisaba la vista pedida con la primera.
- **La ruta /onboarding sigue**: es el wizard del primer ingreso. Los que siguen nombrándola van todos al
  wizard (`AL_WIZARD` en tests/onboarding-hub-retirado.test.ts, cada uno con su motivo); un link nuevo al hub
  frena ese test.

~~⚠️ **DECISIÓN PENDIENTE DE MARTÍN: «Ángulos».**~~ **Cerrado el 23/10/2026**: la recomendación se sacó y Ángulos quedó como
la biblioteca con cuántos anuncios usan cada formato (ver «Ángulos: la recomendación de formatos se sacó», al final).

**Vive en:** `lib/secciones-negocio.ts` · `app/onboarding/tabs-catalogo.ts` · `app/onboarding/page.tsx` ·
`app/second-brain/AreasHub.tsx` · `app/second-brain/VistaCerebro.tsx`

*15/10/2026 · chat «Offer» (cuenta claude1) · no se miró en el navegador.*

## «Se queda en Cargando tu onboarding…» no era un bug: era la máquina sin RAM (15/10/2026)

**Vive en:** `app/onboarding/OnboardingWizard.tsx:228` (el `fetch('/api/onboarding')`) y `:305` (el «Cargando…»)

El chat de Video Editor reportó que `/video-editor?ws=3` redirigía a `/onboarding?ws=3` y se quedaba en «Cargando tu
onboarding…». El sospechoso obvio era el retiro del hub de esa mañana, y **era el equivocado**: ese commit no tocó la rama
del wizard. Medido en el Chrome de Martín, sin escribir nada, por los dos caminos (directo y por el redirect, con el 307
llegando al navegador): documento a ~1,5 s, `/api/onboarding?ws=3` 200 en ~2,4 s, datos a la vista a ~4,2 s, cero
errores de consola. A las 21:05, cuando falló, la máquina tenía ~1 GB libre y Whisper cargado en otra pestaña: era una
hidratación lenta, no una carga trabada.

- **Cómo se distinguen las dos cosas sin adivinar:** «Cargando…» es lo que el server pinta siempre (`data` arranca en
  null), y si el GET falla el wizard pinta el error en rojo. Así que «se queda cargando» es (a) no hidrató o (b) el GET no
  vuelve. Lo decide la pestaña Network: si sale el pedido a `/api/onboarding` y cuánto tarda.
- **Lo que quedó SIN hacer:** el `fetch` de la carga no lleva `signal`. Con la conexión caída a mitad no resuelve nunca
  y la pantalla queda en «Cargando…» para siempre, sin decir nada. Va con `AbortSignal.timeout` y un mensaje que diga
  qué hacer (AGENTS.md, «Un tope que vive en la RUTA no protege al cliente»). Y `/api/auth/me` se pide dos veces en
  paralelo al cargar.

*15/10/2026 · chat «Onboarding» (claude3), con la medición del chat «MaKo Editor» en el Chrome de Martín.*

## El arranque sin API: el paso de la IA frenaba por un motivo que ya no existía (15/10/2026)

**Vive en:** `app/onboarding/OnboardingWizard.tsx` (el `puedeAvanzar` y el paso `gemini`) · `lib/todo-seed-ia.ts` ·
`lib/metodo-catalogo.ts` (la ficha de Anthropic) · `tests/onboarding-sin-api.test.ts`

El paso `gemini` exigía una key con un porqué escrito: «sin una key que ande, Entregable, Avatares, Persona y Ángulos
van a fallar más adelante». Medido el 15/10: **ninguno de esos cuatro está en el wizard de hoy.** Las dos capas que
tienen el paso (`completo` y `agencia`, `lib/capas.ts`) siguen con El Archivero, Productos, el teléfono y las
integraciones, y lo único con IA (El Archivero, Productos y el plan de arranque del cierre) tiene la red de la
plataforma: 3 keys de Gemini y 2 de Groq del ws9. Su carga, del 9 al 15/10, fue de 1 a 100 pedidos por día por key de
Gemini, y un arranque usa de 2 a 61 llamadas del Archivero (la mediana anda en 6). El freno era un comentario
que nadie volvió a medir contra la lista de pasos.

- **El plan de arranque no tenía red** (`generarPlanArranque`). Con el paso opcional, un cliente sin keys terminaba
  el wizard sin su plan, en silencio, porque la pantalla de cierre se dibuja igual sin el borrador.
- **El diagnóstico obvio del crédito de Max era el equivocado.** «Que cargue su crédito de API como key de Anthropic
  y MaKo lo usa» suena completo, y no lo es: desde el veto del 13/08 (`lib/veto-claude.ts`) la key de Anthropic de un
  cliente la usa UNA feature, el análisis de llamadas de cierre, con permiso hasta el 13/11. La ficha decía «el
  cerebro de MaKo: análisis, chats, sugerencias y todos los Analysts», falso desde agosto para cualquiera. Ahora dice
  lo que hace. Si el crédito tiene que mover más, la cascada barata tendría que usar la key de Anthropic del
  cliente, y eso es una decisión de qué modelo paga, no un arreglo. **Se tomó el 16/10** (la decisión A ya lo
  cubría, según el coordinador) y se hizo: `docs/hallazgos-ia.md` → «La clave de Anthropic del negocio».
- **La regla que queda la fija el test, en las dos mitades juntas**: que el paso no frene, y que todo paso con IA
  de una capa que tiene el paso de la IA esté clasificado y tenga red. Un paso nuevo sin clasificar lo hace fallar.
- ⚠️ **CORRECCIÓN DEL 16/10: «tiene la red» era falso para El Archivero.** Su ruta cortaba ANTES con tres
  `if (!(await docsIADisponible()))` («Carga tu API key de Gemini»), así que un cliente sin keys que salteaba el
  paso de la IA se trababa ahí. El test de arriba daba verde porque miraba que la red estuviera escrita, no que nada
  la cortara antes. Arreglado en `daebfcc89` (y aparte, sobre main, en la rama `onboarding-archivero-fix`); el test
  ahora lo fija. El detalle, en `docs/hallazgos-ia.md` → «La red de la plataforma para la primera semana».

### Lo que quedó SIN hacer

- **Después del arranque, 60 llamadas a IA del producto no tienen red** (13 la tienen; contadas el 15/10 en `app/` y
  `lib/`). Un cliente sin keys entra a Ads Writer, Automations o el chat de MaKo y ve «conecta tu IA» (con su botón,
  por `ErrorIA`). Extender la red a todo es una decisión de capacidad: 5 keys gratis de la agencia para todos.
- **No se miró en el navegador**: no se levantó la app por RAM. Falta ver el paso en escritorio y en celular (el
  wizard corre también en el teléfono: `/onboarding` está fuera de la cubierta de MaKo Mobile).

*15/10/2026 · chat «Onboarding» (claude3), medido contra el código y la base, sin subagentes.*

## Si el onboarding deja de ser el wizard: qué tiene que quedar escrito al terminar (16/10/2026)

**Vive en:** `lib/onboarding-state.ts` (`onboardingPendiente`, `patchEstadoOnboarding`) · `lib/onboarding-contrato.ts`
(`onboardingCompleto`) · `app/api/onboarding/route.ts` (la acción `paso`) · `lib/capas.ts` (`onboarding` de cada capa)

Martín decidió reemplazar el wizard por el chat de Offer («el onboarding será ese chat de offer»: nombre → oferta →
funnel → primer CRM). Lo lleva el chat Offer. Esto es lo que el wizard deja escrito hoy y quién lo lee, para que el
chat nuevo no deje a nadie trabado ni el primer día vacío. Medido contra el código el 16/10.

**1. Qué hace que el negocio deje de ir al wizard.** `onboardingPendiente()` es verdadero mientras la capa tenga pasos
(`pasosDeCapaActual()`) y el estado (`getEstadoOnboarding()`) no esté en `'done'`. El estado pasa a `'done'` SÓLO en la
acción `paso` de `app/api/onboarding/route.ts`, cuando `onboardingCompleto` dice que cada paso de la capa está `done`
o `postergado`. Las capas `completo` y `agencia` tienen `fase, gemini, archivero, productos, tabs, integraciones`; la
`pm`, `negocio, fase, plan`. Dos salidas, y la primera es la sana:
- Cerrar cada paso por el MISMO lugar (mejor: sacar esa lógica a `lib/onboarding-state.ts` y que el wizard y el chat
  la llamen), con `done` donde se hizo y `postergado` donde no (sólo `integraciones` y `tabs` se pueden postergar).
- O cambiar el `onboarding` de las capas a los pasos del chat. Eso toca `PASOS_ONBOARDING`, `PASOS_POSTERGABLES`,
  `POSTERGABLE_TXT` y sus tests, y `tests/onboarding-sin-api.test.ts` va a pedir clasificar cada paso nuevo con IA.

**2. Lo que cada paso escribe y quién lo lee el primer día.**

| Paso | Qué escribe | Quién lo lee | Si falta |
|---|---|---|---|
| `fase` | `setDiagnosticoFase` (el Norte); Offer ya usa `guardarFaseSiNoHay`, la misma clave | `/general`, el Perro, el plan de arranque | sin Norte, el Perro prioriza sin la etapa |
| `fase` (canal) | `onboarding.funnel_tipos` y `saveFunnelDefault(templateDeCanal)` si el embudo está intacto | el embudo por defecto del CRM | el CRM arranca con el embudo genérico |
| `archivero` | los documentos, las respuestas del brief (`saveAnswers`) y el panorama | Productos, Ofertas, el plan de arranque, Ads Writer, Second Brain | los generadores escriben sin conocer el negocio |
| `productos` | el catálogo | CRM, funnels, Offer | el CRM sin productos |
| `tabs` | `setContactoReportes` + la verificación por WhatsApp | los reportes diario, horario y semanal, los avisos | los reportes no le llegan a nadie: postergarlo, no cerrarlo |
| `integraciones` | las credenciales | todo lo que lee Meta, Fathom, etc. | postergarlo (el recordatorio de `/general` lo cruza con la conexión real) |
| — (Meta conectado) | `iniciarExtraccion()` pone la extracción en `running`; el cron la sigue | el histórico de leads del CRM | el «primer CRM» sale sin el histórico de Meta, en silencio |
| cierre | `POST /api/onboarding/plan-arranque` DESPUÉS del `'done'` | el borrador del plan (capas con `seedBoardVsl`) | sin plan personalizado; /plan siembra el piso |

**3. A dónde manda a quien no terminó.** Cuatro lugares redirigen a `/onboarding` mientras está pendiente:
`lib/tab-access.ts:48` (toda tab), `app/inicio/page.tsx:47`, `lib/movil-guard.ts:105` y `app/m/configurar/page.tsx`. Si el
chat vive en otra ruta, o `/onboarding` dibuja el chat, o los cuatro apuntan a la nueva — con `rutaConWs`.

**4. El crédito de Claude del onboarding.** Se habilita sumando la feature del chat a `CREDITO_HABILITADO_PARA`
(`lib/veto-claude.ts`) con `soloDuranteElOnboarding`. ⚠️ Pero hoy no alcanzaría: `pedir` (`lib/offer-ia.ts`) llama a
`chatCheapCascade` SIN `redDePlataforma`, y el crédito vive adentro de esa red; después corre su propio bucle sobre las
keys gratis. Para que el crédito llegue, `pedir` tiene que pedir la red de la cascada, o llamar a
`conCreditoDeLaPlataforma` antes de su bucle. **Las dos juntas, no**: la red de la cascada ya trae las keys gratis de
la agencia, y con el bucle de `pedir` detrás se prueban dos veces por pedido (el doble de su cuota por minuto, que es
lo que muerde). Offer eligió la segunda (16/10): su red tiene un plazo propio (`hastaRedMs`) y un respaldo «flojo»
que la cascada no conoce. `'offer'` quedó en la lista ese día, con `soloDuranteElOnboarding`: sin esa llamada en
`pedir`, la fila no hace nada.

**5. Tres trampas del diseño del chat de arranque** (Offer propuso: reusar las claves de `PASOS_ONBOARDING`, sacar
`gemini` y `archivero` de las capas, postergar siempre Meta y borrar el wizard). Medidas el 16/10 contra origin/main:
- ⚠️ **El histórico de Meta lo arranca SÓLO el wizard.** El único que llama a `POST /api/onboarding/extraccion`
  `{action:'start'}` (→ `iniciarExtraccion`) es `OnboardingWizard.tsx:274`. El cron
  (`app/api/cron/onboarding-extraccion`) sólo SIGUE las que están `running`, y su comentario («solo se dispara al
  verificar esa credencial») describía al wizard. Borrar el wizard con Meta siempre postergado deja a todo negocio
  nuevo sin su histórico, sin un error. **Arreglado el mismo día** (`ce583d578`): `arrancarHistoricoEnSegundoPlano`
  (lib/onboarding-extract.ts) lo llaman TODAS las puertas que guardan Meta. `guardarConexionMeta` no era la única: elegir
  la cuenta o la página cuando hay varias, guardar los campos a mano en /integraciones, `/api/metodo` y la acción
  `guardar` del wizard escriben Meta por su cuenta, y elegir la página es justo lo que destraba los leads. Tres trampas
  que salieron haciéndolo:
  - **La lectura tolerante del estado devuelve el INICIAL con la base caída**, y guardarlo le pone `pending` a un
    onboarding terminado: el cliente vuelve al arranque. Quien escribe fuera del wizard lee con
    `getEstadoOnboardingEstricto`.
  - **Un arranque por credencial, no por puerta, son cinco escrituras del estado ENTERO en paralelo** (cada `after` de
    `guardarConexionMeta` leería y guardaría lo suyo). Por eso va una vez al final de cada puerta, no en
    `guardarCredencial`.
  - **«Simular» queda afuera, a propósito**: copia las credenciales del ws1 (Mauricio) al de prueba, y arrancar ahí el
    histórico traería sus leads a otro workspace. `tests/historico-al-conectar.test.ts` enumera en positivo cada
    archivo que llama a `guardarCredencial`: uno nuevo falla hasta que alguien decida.
  - **Y lo mismo para Fathom, YouTube y Panda** (`f33a78559`): cada integración revive SU parte
    (`JOBS_DEL_HISTORICO`) y las puertas genéricas pasan el servicio que guardaron. El de Fathom corre el mismo
    `syncClosingCalls` que el cron de cierre, que ya analiza todas las llamadas sin repetir: adelanta el gasto de Claude,
    no lo suma. Y salieron dos huecos que ya estaban:
    - ⚠️ **El cron del histórico recorría sólo a quien tiene META** (`correrRonda('meta', …)`): un negocio con Fathom y
      sin Meta quedaba con sus llamadas marcadas y nadie que las corriera, sin un error. `correrRonda` acepta una lista
      (cualquiera de) y el cron pasa `Object.keys(JOBS_DEL_HISTORICO)`.
    - ⚠️ **El VSL del histórico nunca corrió para un cliente**: `jobAplica` y `jobVsl` leían los videos sólo del
      setting `youtube_vsl_video_id`, cuyo único escritor (la acción `config` de /api/onboarding) no lo llama nadie;
      /integraciones los guarda como CREDENCIAL (`YOUTUBE_VSL_VIDEO_ID`). Es la forma de la tarea #171 (dos lectores de
      la misma pregunta), y `configWs` (lib/cron-workspaces.ts) ya la había arreglado para los crons de YouTube y Panda
      y no para éste. Un test vecino lo fijaba al revés («que para ELLOS es lo correcto»); se actualizó con su porqué.
  - ⚠️ **Y TODA escritura del estado lee estricto, no sólo el arranque y el cierre** (16/10, después de que el chat
    Offer pasara `cerrarPasosOnboarding` a la estricta y señalara «el resto de los `patchEstadoOnboarding` sigue
    leyendo tolerante»: eso quedó cerrado). `patchEstadoOnboarding` y `iniciarExtraccion` leen con
    `getEstadoOnboardingEstricto`. No era teórico: con el arranque al conectar, el cron corre los ticks del histórico
    —que escriben por `patchEstadoOnboarding` en cada paso— sobre negocios que YA terminaron el onboarding, y un
    5xx de la base en uno de esos patches los mandaba de vuelta al arranque. Ahora el tick tira, el cron lo anota y
    sigue con el siguiente. Lo fija `tests/onboarding-escritura-estricta.test.ts`: cada función que escribe el
    estado, y cada archivo que llama a `setEstadoOnboarding`, en positivo.
  - Y el crédito de Claude quedó en lo que el chat de arranque usa de verdad: `'offer'`, `'El Archivero'` y
    `'onboarding-extract'` (la extracción del brief de los documentos que le mandan). `'productos'` salió con el
    wizard: nada lo llama mientras el onboarding está en curso.
- ⚠️ **`negocio` es el BRIEF, no el nombre.** Las tres pantallas del brief cierran `negocio` (acción `brief` →
  `saveAnswers` en `mako.onboarding.answers`), y en la capa `pm` es lo que el Perro necesita para priorizar
  (`briefGrupos`). Lo leen los generadores (`contenido.run.ts:420`, `video.helpers.ts:349`) y el perfil del negocio
  (`negocio.helpers.ts:105`). Cerrar `negocio` con sólo los nombres los deja escribiendo sin conocer el negocio. Y al
  escribirlo se lee ESTRICTO y se funde: `getAnswers()` devuelve `{}` si la base no contesta, y `saveAnswers` sobre eso
  borra el brief (`negocio.helpers.ts:133`).
- ⚠️ **La capa `pm` no tiene Offer, CRM ni productos** (`navKeys` = todo, mako, productivity-analyst, graphics,
  calendario). Su paso `plan` es el que cierra con «Crear mi primer proyecto» y dispara el plan de arranque: es el
  producto entero de esa capa, y no se le puede sacar por uniformar las capas.

Lo que sí se sostiene solo: `ver_estado_onboarding` (API de MaKo) sale de `capa.onboarding`, y `registrarLogin` con
«llenar el nombre sólo si está vacío» respeta también el que escribió quien invitó (`crearUsuario` lo guarda).

*16/10/2026 · chat «Onboarding» (claude3), medido contra el código, sin subagentes.*

## El onboarding es una conversación: el chat de arranque (16/10/2026)

**El pedido** (Martín, por el Cerebro): «Quiero que elimines todo lo que hay hoy en onboarding tal como
está y que lo reemplaces por el chat de "Offer"… NO quiero que sea un onboarding eterno». El wizard se
borró (`OnboardingWizard.tsx`, `Bienvenida.tsx`, `Listo.tsx`, `/api/onboarding/listo`); lo que pedía cada
pantalla quedó en [onboarding-pasos-anteriores.md](onboarding-pasos-anteriores.md) para que Martín diga
«faltó X».

**Qué pregunta, y por qué tan poco.** Modo `oferta` (Completo, Agencia): nombre → negocio → objetivo a 90
días → la oferta (la conversación de Offer, con el diagnóstico de fase adentro) → el CRM → el teléfono o
«Ahora no» → cierre. Modo `plan` (Project Manager, que no ve Offer ni el CRM): nombre → negocio →
objetivo → a qué se dedica → el diagnóstico con sus opciones → cierre con el plan. NO se pregunta: la zona
horaria (la toma sola `ZonaDelNegocio` del navegador del admin), Meta (se conecta después desde su tab y
el histórico arranca al conectarlo), la IA propia (la red de la plataforma y el crédito de Claude del
onboarding). Las reglas son puras: `lib/onboarding-arranque.ts`.

**Lo que costó, y conviene saber antes de tocarlo:**
- **«negocio» era el BRIEF, no los nombres** (lo marcó el chat de Onboarding antes de que se rompiera). En
  el wizard, las pantallas del brief cerraban `negocio`, y ese brief lo leen los generadores (Ads Writer,
  contenido, video) y el Perro. Si el chat cerraba `negocio` sólo con «Martín» y «Mi negocio», todos
  escribían sin conocer el negocio. Ahora el cierre deja escrito el brief con lo que salió de la
  conversación (`briefDesdeArranque`: la oferta, el cliente, el dolor, el precio, el cuello del
  diagnóstico, el objetivo), FUNDIDO sin pisar lo que había y leído estricto (`mapaParaEscribir`): con la
  base caída, `saveAnswers` sobre `{}` borraba el brief.
- **El primer CRM es el PRINCIPAL, no uno nuevo.** «Nuevo CRM» (`crearCrm`) crea un funnel secundario, y
  todo lead que entra sin asignación cae en el principal (`funnel_id` null): el «primer CRM» arrancaba
  vacío. Se siembra el principal con el tipo que elige (`sembrarCrmPrincipal`: `siembraDeCrm` →
  `saveFunnelDefault`), sólo si está INTACTO y nunca con la lectura caída — el mismo guard que tenía el
  wizard. Y tiene que existir antes de abrir la conversación de la oferta, que nace atada a él
  (`asegurarFunnelPrincipal`, vacío como el de fábrica para que siga intacto).
- **El login de Google pisaba el nombre en CADA entrada** (`registrarLogin`): lo que alguien escribía en
  «Tu cuenta» —y ahora lo que contesta en el chat— se perdía al volver a entrar, sin un error. Ahora el de
  Google sólo llena el vacío.
- **El cierre tiene UNA puerta** (`cerrarPasosOnboarding`, regla `aplicarCambiosDePaso` en el contrato, con
  test): la acción `paso` del wizard y el chat cerraban con dos copias de la misma regla. El teléfono y Meta
  se POSTERGAN si no se hicieron, nunca se marcan hechos (sin destino, los reportes no le llegan a nadie), y
  lo postergado queda de recordatorio en /general.
- **El muñeco** es el de Estrategia del Centro (círculo, verde, sonrisa), con el aspecto pasado por
  VARIABLE `as const`: el tipo `Aspecto` exige `accesorio` en main y lo rechaza en la rama del Centro que
  les sacó los accesorios; un objeto ya construido no pasa el chequeo de propiedades de más. Y con la tinta
  fija: en el tema oscuro `--ink` es casi blanco y los ojos desaparecían sobre el verde.
- **Un efecto que relee con un OBJETO en las dependencias es un bucle**: cada relectura trae un objeto nuevo
  y lo vuelve a disparar. La relectura del chat depende de primitivos (`sesionLigada`, la firma del turno).
- **La pantalla del arranque no navega sola** (Martín: «que jamás se salga el recuadro del chat»): lo que se
  crea se ve en tarjetas (el CRM con sus etapas, los caminos del final) y cada link lo elige la persona,
  con el `Link` de la casa (lleva el `?ws=`).

**Lo que encontró la revisión (nueve bugs confirmados, todos con test probado rompiéndolo).** Los que
vuelven a morder a quien toque esto:
- **El orden del cierre es el arreglo.** `guardarComoOferta` siembra primero la oferta principal DESDE EL
  BRIEF (`seedOfertaDesdeBrief`, una sola vez, quema su guard). Con el brief escrito antes, nacía «X» desde
  el brief y la de Offer chocaba con el nombre y quedaba «X · versión 1»: cada cliente nuevo con DOS ofertas
  iguales, sin un error. El producto y la oferta van antes; el brief, después.
- **El precio que dice el dueño es texto, no un número.** Pasar «$3k» u «800 MXN/mes» a `monto_usd`
  inventaba un monto que el link de cobro usaba tal cual. Va a la descripción («Precio: …») y el monto lo
  pone él en Productos.
- **Las piezas de Offer traen «[completar]» adentro.** Sin filtrar (`sinMarca`), el brief salía con la
  marca y los generadores escribían «[completar]» en los anuncios.
- **Una pestaña vieja contestaba la pregunta de HOY.** Las opciones viajan por índice: la opción 2 de «¿qué
  CRM?» era la 2 de otra pregunta. La opción lleva su texto (`opcionTexto`) y si no coincide la ruta
  devuelve 409 con la conversación vigente, sin anotar nada.
- **«No pude leer» no es «no hay».** Si la lectura de la conversación de la oferta fallaba, la pantalla la
  daba por inexistente y abría OTRA en el funnel principal. La vista distingue `tieneSesion` de
  `sesionCaida`, y ligar, preparar el funnel, cerrar y armar el plan se reintentan sin recargar (el plan
  tiene un estado `'sin'`: antes quedaba «armando» para siempre).
- **El que mira no es el negocio.** El email de los reportes salía del usuario logueado: el super admin o
  una agencia que hacían el arranque mirando al cliente se quedaban con sus reportes. Sale del contacto
  guardado o del perfil del negocio.
- **El nombre provisorio es un email.** Las altas de customer-success y de la agencia guardan el correo
  como nombre cuando no hay uno; el login de Google sólo llenaba el VACÍO y ese ya no lo estaba. Llena también el que contiene `@` — y el chat no
  ofrece un email como «¿te llamo así?».
- **La puerta del cierre leía TOLERANTE** (`patchEstadoOnboarding`): con la base caída da el estado inicial,
  y cerrar un paso encima guardaba un onboarding a medio hacer sobre uno terminado. Lo destapó el merge con
  `getEstadoOnboardingEstricto` del chat de Onboarding; `cerrarPasosOnboarding` lee estricto. Después el chat
  de Onboarding pasó también `patchEstadoOnboarding` e `iniciarExtraccion` a la estricta (ver más arriba),
  así que no queda ninguna escritura del estado sobre la lectura tolerante.
- **Un error de IA en el chat no puede encerrar.** Sin key propia y con la red caída, el chat quedaba sin
  salida: el error trae «Conectar mi propia IA» (el modal de integraciones, sin salir de la tab).

**Lo que encontró el recorrido en el ws3** (16/10, 1440×900 y 390×844, con una foto de todo el ws3 antes y
la vuelta exacta después — `scripts/ws-prueba-foto.mjs`). Ni los tests ni la revisión lo habían visto:
- **El diagnóstico que Offer deja para después TRABABA el arranque.** El diagnóstico de fase va adentro de
  la conversación de la oferta, y Offer lo vuelve obligatorio cuando ya están las piezas mínimas — pero eso
  lo decide el turno de la IA, y el botón **«Armar mi oferta» no pasa por el turno**: arma igual. En la tab
  Offer da lo mismo; en el arranque la etapa pedía «puede concluir Y diagnóstico guardado» para pasar al
  CRM, y se quedaba en 'oferta' para siempre, con la pregunta ya fuera de pantalla («¿La pulimos?» en su
  lugar) y sin un error. Ahora, con la oferta armada y el diagnóstico sin guardar, la etapa es 'fase' y
  las preguntas que faltan las hace el arranque (las mismas del modo plan, `preguntarFase`), sin repetir
  lo que ya contestó en Offer (`conFaseDeOffer`, leído de los mensajes de la conversación con
  `estadoDiagnostico`). Ojo: si no contestó ninguna en Offer son siete preguntas seguidas.
- **Una animación le gana a un `opacity` estático.** La leyenda entra con `animation: … both`, y la regla de
  salida (`opacity: 0` con transición) no la tocaba: el texto quedaba opaco encima del chat durante el vuelo.
  El grafo, que no tiene animación propia, sí se iba. La salida de algo que entró animado es otra animación.
- **Con UN producto ya cargado, la oferta del onboarding se liga a ése** (regla de Offer,
  `ligarProductoQueCorresponde`: «el que se llama igual, o el único que hay»), y el selector de la tab Offer
  nombra al funnel por ese producto. En un cliente nuevo no pasa: el cierre crea primero el producto de la
  oferta (por eso el orden importa). Se vio porque el ws3 tenía un producto de otra prueba.
- **Recargar a mitad de la oferta vuelve a la MISMA conversación** (una sola fila en `offer_sesiones`), la
  oferta queda UNA sola vez (sin «· versión 1») y el ws3 terminó con el funnel principal sembrado, el brief,
  el diagnóstico, el onboarding cerrado con el teléfono y Meta postergados, y el histórico quieto.
- **En el teléfono, recargar después de terminar muestra «Esta pantalla se usa en la computadora»**: es la
  guardia de MaKo Mobile, que sólo deja pasar `/onboarding` mientras está pendiente. Quien termina en el
  teléfono ve el final sin recargar.

**La interpretación que tomé** (para que Martín la corrija si no era): «una animación de los mismos 3
pasos» = los tres tiempos de la bienvenida de antes (el centro → las cinco piezas → las áreas), solos y
con MaKo como el centro del grafo; al terminar MaKo vuela a su lugar de foto del chat.

**Lo que quedó SIN hacer:**
- **Lo que no se vio en el navegador:** la capa Project Manager (no hay un workspace de prueba con esa capa;
  se recorrió con las reglas puras), el teléfono con su código de WhatsApp (se eligió «Ahora no» para no
  mandarle un mensaje a nadie), subir un documento al Archivero desde el chat, y los links del final
  abiertos (se miraron sus `href`). Y en modo dev salió un aviso de hidratación por atributos en
  `/onboarding` que no se rastreó (sospecha: `TemaOscuroScript`, que ya usaba el wizard).
- **El aviso cuando la oferta termina de armarse si la persona se fue** (WhatsApp de MaKo y la app).
- **La API de MaKo no cambió, a propósito:** el onboarding es la primera conversación de una persona y no
  tiene sentido que un agente la haga por ella; `ver_estado_onboarding` ya lo cuenta, y lo que el chat crea
  (el CRM, la oferta, el brief) ya tiene sus operaciones.

**Vive en:** `app/onboarding/ChatArranque.tsx` · `app/onboarding/IntroMako.tsx` · `app/onboarding/MunecoMako.tsx` ·
`app/onboarding/arranque-ui.ts` · `lib/onboarding-arranque.ts` (lo puro) · `lib/onboarding-arranque-server.ts`
(los hechos, la siembra, el cierre) · `app/api/onboarding/arranque/route.ts` · `lib/onboarding-state.ts`
(`cerrarPasosOnboarding`) · `lib/onboarding-guard.ts` · `lib/usuarios.ts` (`registrarLogin`) ·
`tests/onboarding-arranque.test.ts` (23 tests; 10 roturas en la primera vuelta, 9 tras la revisión y 7
tras el recorrido, cazadas con los de postergar y sin-api) · `scripts/ws-prueba-foto.mjs` (la foto del ws3)

*16/10/2026, cuenta claude3.*

## El onboarding sin el análisis de Offer: pregunta qué vende y lo deja en un PDF (17/10/2026)

**El pedido** (Martín, 16/10 a la tarde; textual en docs/feedback-16-10-crm-onboarding-second-brain.md):
«Sería bueno que la funcionalidad de "OFFER" no esté en el onboarding... Pero simular "Offer" en el onboarding
simplemente para organizar en un PDF lo que vende el usuario. Y eso le sirve a MaKo para crear las cosas que
necesite». Cambia lo decidido esa misma mañana («el onboarding ES el chat de Offer»).

**Cómo quedó.** Modo `oferta`: nombre → negocio → objetivo → LO QUE VENDE (la conversación de Offer en su versión
del onboarding) → «Listo: ordené lo que vendes en un PDF» con su link → el diagnóstico de fase con sus opciones →
el CRM → el teléfono → cierre. La conversación pregunta sólo `PIEZAS_DEL_ARRANQUE` (qué es y qué recibe, para
quién, qué le resuelve, qué logra, cuánto cuesta: las cinco son mínimas de Offer, así que la tab no las vuelve a
pedir), con su propio prompt (`offer.arranque.system`, editable en Configuraciones) y sin «Armar mi oferta». El
PDF lo arma `lib/lo-que-vendes-pdf.ts` con las palabras del dueño, cada vez que se pide (GET /api/offer/pdf con
`tipo=lo-que-vendes`, el mismo gate). El análisis y la oferta mejorada se hacen después en /offer, sobre la
MISMA conversación («Analizar mi oferta» en la tarjeta final).

**Lo que decidí leyendo, y Martín puede corregir:** «el diagnóstico» que se saca es el de la OFERTA (la rúbrica
de 9 dimensiones y la oferta nueva: los dos pasos de «Armar mi oferta»). El diagnóstico de FASE se queda: es el
Norte de MaKo (lo leen el system de MaKo, /general y el Perro) y no es una función de Offer. Ya no va adentro de
la conversación (la IA lo adaptaba pregunta por pregunta, varios turnos de espera): lo pregunta el arranque con
sus opciones, que es tocar seis veces. Si también tiene que salir, es `etapaDeArranque` y `cierreDePasos('fase')`.

**El diagnóstico obvio era el equivocado: cambiar el prompt no alcanzaba.** «Armar mi oferta» salía de tres
lugares y el prompt era uno solo:
- **La pantalla armaba la oferta SOLA**: `OfferApp` en modo arranque tenía un efecto que, con las piezas, pedía
  `armar` por detrás (`arranque.armar`). Con el prompt nuevo, el análisis igual corría.
- **El botón lo pone el CÓDIGO, no el modelo**: `mensajeDeMako` agrega «Armar mi oferta» cuando `puedeConcluir`.
  En el onboarding va en `false` aunque estén las mínimas.
- **El riel** (las 20 piezas y su botón de armar) también lo ofrecía: en el arranque no se dibuja.

**Y el modo tiene que viajar en LOS DOS caminos del turno.** El servidor no sabía qué conversación es la del
onboarding salvo en `armar` (`origen`). Ahora la pantalla manda `origen: 'arranque'` y el servidor lo cree sólo
con el onboarding pendiente (`delArranque`: después, la misma conversación es la de la tab). Si el reintento (la
IA falló y se toca «Reintentar») no lo lleva, ese turno vuelve a la conversación entera, con la fase y el botón.

**Otras dos que muerden:**
- **La ruta del PDF de Offer contesta 404 «todavía no tiene conclusión» ANTES de cualquier otra cosa.** El PDF de
  lo que vende no tiene conclusión por definición: su rama va antes de ese chequeo.
- **Las conversaciones de antes** (empezadas con el onboarding viejo) pueden traer respuestas de la fase: el
  arranque las lee (`faseOffer`) y no las repite. Y una con la oferta ya armada cumple `loQueVende` igual (las
  mínimas incluyen las cinco); el cierre guarda su oferta sólo si la hay.

### Lo que quedó SIN hacer

- **El PDF no queda guardado como documento** (El Archivero, el Second Brain): lo que MaKo usa es el brief que
  deja el cierre y las piezas de la conversación. Guardarlo como documento pagaría una extracción por cliente.
- **El producto, sin una oferta armada, se llama «Oferta de {negocio}»** (lo renombra en Productos).
- **MaKo Mobile** (`app/m/offer/OfferM.tsx`) no conoce el modo del onboarding: el teléfono hace el onboarding en
  la misma página (/onboarding), así que no muerde hoy.

**Vive en:** `lib/offer-marco.ts` (`PIEZAS_DEL_ARRANQUE`, `faltanDelArranque`) · `lib/offer-reglas.ts`
(`guiaDelArranque`, `faltanDelArranqueParaPrompt`) · `lib/offer-ia.ts` (`OFFER_ARRANQUE_SYSTEM_TEMPLATE`,
`turnoOffer({ arranque })`) · `lib/prompt-registry.ts` · `app/api/offer/route.ts` (`delArranque`, `responder`) ·
`app/offer/OfferApp.tsx` · `lib/lo-que-vendes-pdf.ts` · `app/api/offer/pdf/route.ts` · `lib/onboarding-arranque.ts`
(`loQueVende`, la etapa y el mensaje `arr-pdf`) · `lib/onboarding-arranque-server.ts` (los hechos y el cierre) ·
`app/onboarding/ChatArranque.tsx` (`TarjetaPdf`) · `tests/onboarding-lo-que-vende.test.ts` (14 roturas, 14
cazadas, junto con tests/onboarding-arranque.test.ts)

*17/10/2026, chat «Onboarding», cuenta claude4.*

## El onboarding entiende lo que le dicen, y suma dos preguntas que cambian algo (17/10/2026)

**El pedido** (Martín, desde el Ops Center): «le dije "Soy Martin" y me respondió "Un gusto, Soy. ¿Cómo se llama tu
negocio?", eso es básico... investiga las preguntas que nos hacen falta: me imagino "¿Cómo nos conociste?", "¿Qué
funcionalidad de estas te interesa más?"».

**El nombre:** el saludo tomaba la PRIMERA palabra de lo escrito. Ahora `extraerNombre` saca el saludo y la
presentación («hola, soy», «me llamo», «mi nombre es», «me dicen»), corta en la primera coma o en lo que ya no es un
nombre, y se queda con hasta tres palabras. Si nombró su negocio («Martín de Acme», «tengo una agencia que se llama
Pixel»), vuelve como SUGERENCIA para la pregunta siguiente, nunca como respuesta: en «Martín de Córdoba» lo de después
del «de» es un lugar. El negocio pasa por `extraerNegocio` («Se llama Acme» → «Acme»).

**Lo investigado antes de sumar preguntas:** el abandono de una encuesta de bienvenida sube con cada pregunta, más
rápido en las primeras (SurveyMonkey, ~100.000 encuestas); las de producto que funcionan son cortas y cada pregunta
CAMBIA algo visible (si no cambia nada, se saca); y una encuesta corta adentro de la app termina por encima del 80%.
Por eso son dos, de un toque, y cada una decide algo:
- **«¿Cómo llegaste a MaKo?»** (`ORIGENES`, o lo que escriba): de dónde vienen los clientes. Lo mira el super admin
  para la pauta (la ventana del 1/11 al 15/12).
- **«¿Qué te gustaría que MaKo resuelva primero?»** (`INTERESES`): decide a qué pestaña entra al terminar
  (`rutaDeEntrada`): anuncios → Ads Writer, ventas → CRM, WhatsApp → Automations, organizar → Plan. Sólo en las capas
  que ven todo (el Project Manager no tiene anuncios ni CRM).

Las dos van antes del objetivo, y quedan en el setting `onboarding.encuesta` al cerrar (`ver_estado_onboarding` de la
API de MaKo las devuelve). ⚠️ Una conversación que ya había pasado el objetivo (empezada antes) NO vuelve atrás a
preguntarlas: sin esa regla, quien estaba a mitad del onboarding veía aparecer dos preguntas viejas.

### Lo que quedó SIN hacer

- **El super admin todavía no tiene una pantalla que junte los orígenes** de todos los clientes: hoy se leen por
  cliente (setting y API). Una tabla en la ficha del cliente o en el panel de la plataforma es lo que sigue.
- El texto libre de «¿Cómo llegaste?» no se normaliza («por un amigo» y «Me lo recomendaron» cuentan distinto).

**Vive en:** `lib/onboarding-arranque.ts` (`extraerNombre`, `extraerNegocio`, `ORIGENES`, `INTERESES`, `interesDe`,
`rutaDeEntrada`, `CLAVE_ENCUESTA`) · `lib/onboarding-arranque-server.ts` (el cierre) ·
`lib/api-mako/areas/negocio.run.ts` (`ver_estado_onboarding`) · `app/onboarding/ChatArranque.tsx` (la entrada al
terminar) · `tests/onboarding-preguntas.test.ts` (11 roturas, 11 caen)

*17/10/2026, chat «Onboarding», cuenta claude4.*

## La guardia del onboarding: lo paga Martín, así que tiene topes (17/10/2026)

**El pedido** (Martín, desde el Ops Center): «Como el onboarding lo pago yo en tokens, mete mucha ciberseguridad contra
ataques DDoS o cosas así, si me envían mil consultas... O si un troll le empieza a decir cualquier cosa, que tenga la
capacidad de bloquear al usuario».

**Dónde se gasta:** el onboarding usa el crédito de Claude de la plataforma (`CREDITO_HABILITADO_PARA`). Mientras está
pendiente ninguna otra tab se abre, así que TODO pedido de IA a /api/offer en ese momento es el onboarding. Ahí y en
/api/onboarding/arranque va la guardia (`lib/onboarding-guardia.ts` las reglas, `-server.ts` la base):

1. **La ráfaga**, por minuto, por usuario y por IP (`lib/rate-limit.ts`, en memoria). ⚠️ Es POR INSTANCIA: frena un
   script, no un ataque distribuido. Contra eso está la protección de Vercel; para un tope duro entre instancias
   hace falta un store compartido (Upstash), que la casa no tiene.
2. **El tope por onboarding**, en la base (`onboarding.guardia`): 60 turnos de IA y 15 documentos. Es el que protege
   la plata, entre instancias y entre días. Contar lo que vende lleva de 5 a 10 turnos.
3. **El troleo**: un insulto DIRIGIDO («sos un inútil»; una mala palabra suelta en un mensaje largo es alguien contando
   su mes, no un troll), un intento de sacarla de su papel («ignora tus instrucciones», «muéstrame tu system prompt»)
   o basura (teclado aporreado). Suma una falta y NO llega a la IA: no se paga. A la tercera se bloquea el onboarding
   y sale un email al equipo de la plataforma (el remitente y los destinatarios de los avisos de la voz). Lo desbloquea
   el super admin mirando al cliente, desde la misma pantalla.

Y el análisis entero (`armar`, `diagnosticar`, `generar`) no corre con el onboarding pendiente: el onboarding ya no lo
pide, y por la API sería la parte más cara.

### Lo que quedó SIN hacer

- **Sin store compartido, la ráfaga es por instancia.** El tope de la base sí vale siempre.
- **El troleo es por reglas, no por IA** (una IA para moderar también se paga). Lo que no matchea pasa: ante la duda,
  no es falta.
- **El email del bloqueo no se probó contra Resend de verdad.**

**Vive en:** `lib/onboarding-guardia.ts` · `lib/onboarding-guardia-server.ts` · `app/api/offer/route.ts` (la guardia antes
del `switch`) · `app/api/onboarding/arranque/route.ts` (`responder`, `telefono`, `desbloquear`) · `app/onboarding/ChatArranque.tsx`
(la pantalla bloqueada) · `tests/onboarding-guardia.test.ts` (14 roturas, 14 caen)

*17/10/2026, chat «Onboarding», cuenta claude4.*

## El onboarding en claro, sin recuadro, y MaKo entra cuando la tocas (17/10/2026)

**El pedido** (Martín, desde el Ops Center, con una imagen de referencia): «El onboarding, que sea white mode, como
todo... En el onboarding elimina la animación del grafo... haz una buena entrada de la criatura de MaKo tipo motion
graphics, y que al clickearla recién pase al siguiente mensaje... Y debe parpadear y reaccionar con las respuestas...
Bien responsive... sin recuadro de chat, sin el bloque».

**Cómo quedó:** el tema oscuro forzado se fue de la página (como en el Second Brain el 16/10). La cabecera es la de la
referencia (la cara de MaKo, «MaKo» y «Tu onboarding», y una línea). Los mensajes van sueltos sobre el fondo, y el
contenido es una columna de 960 px como máximo, con medidas propias en el celular. `EntradaMako` reemplaza al grafo:
MaKo cae con un rebote, se abren dos anillos con chispas, saluda y **espera**. Recién al tocarla (o con Enter) vuela a su
lugar de foto y empieza el chat. La cara reacciona: piensa mientras guarda, se alegra si la respuesta entró y duda si
no se entendió.

**Lo que conviene saber antes de tocarlo:**
- **El recuadro no es del onboarding, es del motor de Offer** (`ChatOffer` y `ChatHilo`, con sus estilos en línea). Se
  aplana con CSS acotado a `.arr-capa` y con `!important`, así la tab Offer conserva su caja. Si alguien cambia la
  estructura de `ChatHilo`, el selector `.of-hilo-lista > div > div` puede dejar de apuntar a sus franjas.
- **La estrella todavía no está:** la dibuja Ops Center 3 para todas las criaturas, y se le pidió el componente el
  17/10. Hasta que llegue, `CriaturaMako` es un ADAPTADOR con el muñeco de hoy y los gestos en CSS. La pantalla sólo
  conoce `reaccion`, y el test prohíbe dibujar el muñeco directo, así que cambiar a la estrella toca un solo archivo.
- **«Al clickearla recién pase al siguiente mensaje»** se leyó como la ENTRADA: la toca para empezar. Si Martín quería
  un clic por cada mensaje de MaKo, es otro cambio (en `mensajesDeArranque`, mostrar de a uno).

### Lo que quedó SIN hacer

- **Nadie lo miró en el navegador** (sin RAM para el recorrido local; el Cerebro lo deja para la prueba de Martín en el
  ws3). En especial: el aplanado del hilo en Safari y el vuelo a la foto en el celular.
- La estrella de verdad (Ops Center 3).

**Vive en:** `app/onboarding/page.tsx` · `app/onboarding/ChatArranque.tsx` (la cabecera, el CSS sin recuadro, las
reacciones) · `app/onboarding/EntradaMako.tsx` · `app/onboarding/CriaturaMako.tsx` · `tests/onboarding-arranque.test.ts`
(10 roturas, 10 caen)

*17/10/2026, chat «Onboarding», cuenta claude4.*

## Lo tachado del diagnóstico, cómo llegó cada cliente y «Lo que vendes» en El Archivero (17/10/2026)

- **«Qué hacer ahora» se guarda** en el mismo diagnóstico (`hechas`, PATCH /api/onboarding/fase) con un compare-and-set
  sobre el texto leído: si en el medio se rehízo el diagnóstico (otra fase, otra lista), no se pisa. Rehacerlo lo vacía
  (`diagnosticar` no lo trae). MaKo lo lee: `faseContextoTexto` dice qué hizo y qué le falta.
- **«Llegó por» en la tabla de clientes del super admin** (y en el CSV): se lee `onboarding.encuesta` de TODOS los
  negocios con el cliente crudo, como los leads de esa misma ruta (con `getTenantDb` saldría sólo el del super admin).
- **«Lo que vendes» queda en El Archivero, SIN extracción** (decisión con criterio): sus datos ya están en el perfil
  (el brief que escribe el cierre, de las mismas piezas); leerlo con la IA sería pagar por saber lo que ya se sabe. Una
  vez por negocio (por el nombre del archivo: el PDF lleva la fecha y el contenido cambia).
- **Vive en:** `lib/fase-diagnostico.ts` (`sanearHechas`) · `lib/fase-store.ts` (`guardarHechasFase`) ·
  `lib/onboarding-arranque.ts` (`llegadaDe`) · `app/api/admin/workspaces/route.ts` · `lib/onboarding-arranque-server.ts`
  (`archivarLoQueVendes`).

*17/10/2026, «Pendientes B3» (`claude4`).*

## «Consultesis» en otro negocio: el chat no se volvía a montar al cambiar de workspace (18/10/2026)

Martín, feedback del 18/10 (punto 15): al abrir otro negocio le aparecieron respuestas previas de otro («Consultesis»).

- **Lo que dice la base (medido, sólo lectura):** «Consultesis» existía SÓLO en `onboarding.arranque` del ws 3 (13:41 de
  ese día). Ningún otro workspace lo tenía, y no se había creado ninguno desde el 16/10. El server no lo prestó: el
  estado del arranque es por workspace (`getSetting` filtra `workspace_id`) y la conversación se lee con `getTenantDb`.
- ⚠️ **Lo mostró la PANTALLA.** `ChatArranque` arranca su estado de `inicial` UNA vez (`useState(inicial)`). Pasar de
  un `?ws=` a otro sin recargar deja montado el mismo componente: la vista nueva llega en las props y en pantalla siguen
  las respuestas del negocio anterior. **Regla:** un componente cliente que guarda datos de un negocio en su estado se
  monta con `key` del workspace (app/onboarding/page.tsx).
- **La otra vía, sin tocar:** la cookie vieja `mako_ws` vale para TODO el navegador (lib/workspace.ts,
  `resolverDesdeCookies`), y la siguen escribiendo `Sidebar.entrarComoDuenoYNavegar` y los `NoEsTuyo` del Plan y el
  CRM. Un super admin que abre /onboarding sin `?ws=` cae en el negocio de esa cookie. Si vuelve a pasar con la key
  puesta, mirar eso primero.

**Vive en:** `app/onboarding/page.tsx` (la key) · test `tests/onboarding-otro-ws.test.ts`

## El onboarding del 18/10: explica, pregunta menos, halaga en serio y termina en el Ops Center

Pedido de Martín (punto 15 del feedback del 18/10), en cuatro commits de la rama onboarding-v3:

- **Explica antes de preguntar** (`SALUDO_ARRANQUE`): para qué son las preguntas y que tardan menos de 5 minutos.
- **Sin el botón «Soy»:** el nombre de la cuenta pasa por `extraerNombre` antes de ofrecerse. Una cuenta guardada como
  «Soy Martín» ofrecía «Soy».
- **Sin el objetivo a 90 días:** del negocio se pasa directo a lo que vende. El de una conversación de antes sigue
  llegando al brief (`negocio_objetivo`). «¿Cómo llegaste?» y «¿Qué resolver primero?» van AL FINAL, después del CRM y
  antes del teléfono.
- **El prompt del arranque** (`OFFER_ARRANQUE_SYSTEM_TEMPLATE`):
  - antes de cada pregunta, una frase genuina que nombra algo concreto de lo que contó, y nunca elogia lo que no es
    bueno;
  - `opciones` siempre, salvo al pedir el link;
  - una pregunta por pieza, sin detalles de entrega («las primeras 24 horas»).

  ⚠️ El ejemplo viejo de la regla 4 («¿qué recibe exactamente tu cliente?») es lo que llevaba a la IA a preguntar
  detalles de entrega.
- **Al terminar, al Ops Center** (`RUTA_AL_TERMINAR = '/second-brain'`). El interés queda en la encuesta.
- **La entrada avanza sola** a los 2,4 s (tocarla la adelanta), sin los anillos azules.
- **La cara es la ESTRELLA del Ops Center**: `CriaturaMako` envuelve la `Criatura` de app/admin/operaciones con
  `ASPECTO_MAKO`, la misma de la barra lateral desde el run 141. ⚠️ Yo la había dado por «del próximo Ops Center»
  porque Ops Center 3 dijo que no estaba hecha. Ya existía: antes de esperar a otro chat, buscar el componente en el
  árbol (`git grep ASPECTO_MAKO`). Se borró el muñeco redondo propio (`MunecoMako`).

**Sin hacer:**
- La misma animación como pantalla de CARGA de toda la app («nota la app lenta al cambiar de tabs»): toca el layout y
  `tests/layout-sin-suspense.test.ts`.
- Que la criatura vuele a la sidebar de los chats del Ops Center al terminar.
- El modo plan sigue entrando a /plan: la capa Project Manager puede no ver /second-brain, y no se miró.
- El chat del onboarding con el diseño del chat del Ops Center: después del 20/10.
- Quedó CSS muerto de los anillos y de «Tócame» en `EntradaMako.tsx`.

## Florencia (ws21, 18/10): el nombre del negocio, la conversación sin corte y el chat «Onboarding» que no llega a quien ya terminó (20/10/2026)

- **El nombre: el diagnóstico obvio («el regex no entiende») es cierto, pero no es la causa de fondo.** `extraerNegocio` solo quita «se llama/es/son/somos» del principio, así que «(Es) mi marca personal: Florencia Ayelen Carballo» quedó tal cual en `workspaces.nombre`. De ahí pasó al funnel principal, al producto («Oferta de …»), al PDF y a su archivo en El Archivero.
  - 12ad33b25 (18/10 14:50) sacó las respuestas rápidas del nombre y del negocio. Desde entonces el nombre del alta («Consultora Argentina», medido por el slug) no se ofrece, y la respuesta libre lo escribía sin confirmar.
  - ⚠️ **El diagnóstico obvio («se sacaron por el ws de prueba, cuyo problema era el RESET») era el equivocado.** Con esa lectura el 20/10 volvió el nombre del alta como botón. Pero detrás de ese commit había un pedido LITERAL de Martín («Sin respuestas rápidas en las preguntas del nombre y del nombre del negocio»), y esa noche el Cerebro sacó el botón otra vez. La red que faltaba era la confirmación, no el botón.
  - El texto crudo que escribió la persona no se guarda en ningún lado, solo lo extraído.
  - **Regla:** un dato que se copia a cinco lugares se confirma antes de escribirlo. Y antes de devolver algo que un commit sacó, se busca si lo pidió Martín (la bitácora del área, el feedback del día): un pedido literal no se revierte con un diagnóstico técnico.

- **`preguntaAbierta` hizo al onboarding rehén del modelo.** 96971a73c (18/10) no deja pasar al PDF mientras el último mensaje de MaKo pregunte algo. Pero el cierre depende de que el modelo cumpla la regla 8, y su `listo` se parsea y nadie lo lee (lib/offer-reglas.ts:1113).
  - Caso real: con las 3 piezas anotadas a las 22:43:34, MaKo siguió 6 preguntas y 10 minutos más (escalera, ventas, prueba, plazo, primera semana), que son justo las piezas del análisis que el punto 5 del 18/10 sacó. Antes había preguntado el precio 4 veces.
  - **Regla:** que el onboarding terminó lo decide el código con lo medido (`faltanDelArranque`), nunca el modelo.

- **Una respuesta rápida tocada se anota como palabras del dueño.** El turno #6 trajo UNA sola opción («Un plan de trabajo con hitos, tareas y seguimiento semanal»). Ella la tocó, y esa frase es hoy la 1ª sección del PDF y el `incluye` del producto. Los rangos de precio de las opciones también los inventó MaKo.

- **«sin dato:» no es «[completar]».** `sinMarca` solo filtra la marca de cifras. Por eso «sin dato: en 200 casos, 100% llegó a defender…» llegó a la promesa del producto y al brief, y el PDF le dijo «Todavía no lo tienes claro» sobre su mejor dato. Además, 'escalera' no tiene título en el PDF (no sale) y TOPE_PIEZA = 400 corta las piezas con «…».

- **Un link que no abre no le avisa al modelo** (app/offer/OfferApp.tsx:366-372). MaKo dijo «vi tu Instagram» sin haberlo leído: la guardia contó 2 lecturas pedidas y hay 1 documento guardado.

- **El hilo «Onboarding» (b222b34fc) solo nace en la pantalla del onboarding al llegar a 'listo'.** /onboarding redirige a quien ya terminó, así que no cubre a nadie que haya terminado antes del deploy. Medido el 20/10: el único caso es el ws21, con 0 chats en chart_sessions. Hace falta un relleno aparte.

**Vive en:** lib/onboarding-arranque.ts (extraerNegocio, sinMarca) · lib/onboarding-arranque-server.ts (cerrarArranque) · app/api/offer/route.ts (responder) · lib/offer-reglas.ts (mensajeDeMako) · app/offer/OfferApp.tsx · lib/lo-que-vendes-pdf.ts · *2026-10-20*

**Lo que suma la llamada con Florencia (Fathom 864249059, 18/10):**
- **«Me escribió en inglés» no fue MaKo:** ningún mensaje de la sesión 14 está en inglés. Fue el ChatGPT con el que ella armaba el texto largo, que después no entró por el tope de 12.000 caracteres del chat (`TOPE_MENSAJE`, app/api/offer/route.ts:115). Un texto largo tiene que ir como documento, por el mismo camino que el audio, no rebotar con un 413.
- **Las preguntas con opciones no aceptan texto** (lib/onboarding-arranque.ts:570 y :586 devuelven «Elige una de las opciones.»), y la pantalla tampoco avisa que se puede escribir otra cosa.
- **Lo que contestó en «¿qué querés que MaKo resuelva primero?» no se usa:** `rutaDeEntrada` (lib/onboarding-arranque.ts:194) no tiene llamadores, y la salida siempre va a /second-brain sin guía ni soporte visible.
- **«Lo justo» estaba desplegado y el onboarding igual duró 45 minutos** (22:22→23:07 UTC, contra «menos de 5» del saludo). El diagnóstico obvio, que el límite de 3 piezas (6470c86f6) no estaba en producción, era el equivocado: 3413c63aa estaba READY desde las 21:35 UTC. La causa es la de arriba: el corte lo decide el modelo.

**Lo que quedó, y las reglas (20/10/2026, chat «Onboarding», rama onboarding-v3):**
- **El corte lo escribe el código.** Con `faltanDelArranque` vacío, el mensaje es «¡Gracias!» sin opciones, diga lo que diga el modelo (`mensajeDeCierreDelArranque`). Una pieza se pregunta dos veces como mucho: a la segunda respuesta sin anotar queda «sin dato:» (`conTopeDelArranque`). La pieza que se pregunta es la PRIMERA que falta en el orden de la guía, y por eso la nota va sin el texto del dueño: podría no ser la que MaKo preguntó.
- **El nombre se confirma antes de escribirse: TODO lo escrito** (la revisión de la noche mostró que la lista de casos dejaba pasar «No tengo», «Soy yo», «Hola» y «🌸»; ver la entrada de abajo). Ninguna de las dos preguntas ofrece opciones, tampoco el nombre del alta (Martín, 18/10; el botón volvió y se fue el 20/10). Ojo al probar `extraerNegocio`: la regla general de los dos puntos ya cubre «mi marca personal: X», así que un test con dos puntos no prueba la específica (hace falta el caso con guion).
- **Una opción tocada no es palabra del dueño:** en el onboarding se va la respuesta rápida con un número que el dueño no dijo, y con menos de dos no se ofrece ninguna (`opcionesDelArranque`).
- **El chat «Onboarding» de quien ya terminó** se crea en su primera visita a /second-brain o /m/second-brain (sólo quien contestó, nunca mirando como super admin). Ya NO se reconoce por el título: por la marca de su contexto (entrada de abajo). Florencia lo recibe la primera vez que entre después del deploy.
- **La nota de voz se queda en el onboarding.** El dictado del Ops Center no se pudo probar con 2 minutos (ver hallazgos-infra, «Probar el dictado con un micrófono falso…»), y el otro camino del botón usa las keys del negocio (hallazgos-plan). La caja es la del Ops Center; su micrófono graba la nota con la sesión de voz de la casa.
- **Reparar el ws21** quedó escrito y sin correr: `side-session-notes/…/feedback-20-10/reparar-ws21.ts` (sin `--aplicar` sólo lee). Corre con el sí de Martín y el nombre que él elija.
- **Sin hacer:** el diagnóstico de fase repite el canal que ya contó en la conversación (5b, lib/onboarding-arranque.ts → preguntarFase); el voseo y el «Perfecto:» del modelo no tienen filtro de salida (lib/offer-ia.ts); `TOPE_PIEZA` = 400 sigue cortando las piezas largas con «…» (lib/offer-reglas.ts); la salida del hilo lista lo que MaKo puede hacer, pero sin botones (chart_chats no guarda opciones).

## El CRM a medida, el hilo que no puede ser el primero, y la caja del Ops Center (20/10/2026)

- **El CRM a medida cambia NOMBRES, nunca claves.** Martín pidió que el CRM del onboarding fuera «personalizado». Lo
  tentador es que la IA arme las etapas enteras, y no se puede: las nutriciones, los avisos y las automatizaciones mueven a
  cada cliente por la `key` de su etapa (`lead`, `agenda`, `ganado`…). MaKo elige un tipo de `TIPOS_CRM` entre los de
  su canal y sólo renombra; `parsePropuestaCrm` (lib/onboarding-crm.ts) tira un tipo fuera de la lista y deja el nombre de
  fábrica a uno largo, con emoji o repetido. Se guarda una vez (`crmPropuesta`; `null` = no salió y queda la plantilla).
- **La propuesta se arma en el POST que PASA a la etapa del CRM, y relee los hechos.** Con los hechos de antes de guardar,
  la última respuesta de la fase todavía no figura como diagnóstico guardado y `etapaDeArranque` sigue diciendo «fase»: la
  propuesta no se armaba nunca. Se relee sólo si la etapa era `pdf` o `fase` (releer siempre son ocho lecturas por mensaje).
- **El hilo «Onboarding» no puede ser el primer chat.** El jefe del cliente («Second Brain») es la sesión MÁS VIEJA de su
  chartKey: si el del onboarding se creaba primero, quedaba como jefe. Por eso se crea antes una sesión vacía si no hay.
- **La caja del Ops Center no se importa en ChatOffer**: ver hallazgos-offer.md (un test carga ChatOffer en node).

*20/10/2026, chat «Onboarding» (claude4), rama onboarding-v3.*

## La revisión adversarial de onboarding-v3: lo que el test feliz no veía (20/10/2026, noche)

El Cerebro revisó la punta beb153118 con tres lentes (hilo y aislamiento, arranque y CRM, regresiones) antes de subirla:
un bloqueante y seis importantes, todos comprobados con sondas. Todo arreglado en la misma rama, cada uno con su test
probado rompiéndolo. Lo que queda como regla:

- **`\b` en JavaScript es ASCII: después de «í» no hay límite de palabra.** `/^(?:s[ií]|correcto)\b/i` reconocía «si» y
  no «Sí». Con un nombre por confirmar, el «Sí» escrito iba como nombre del negocio: `workspaces.nombre` = «Sí», funnel
  «Sí», producto «Oferta de Sí». Es el bug de Florencia, peor. La flag `u` NO arregla `\b`: hay que cortar con
  `(?=$|[\s,.!?])` o `(?![\p{L}\p{N}])`, o normalizar y comparar la frase entera (`siONo`, lib/onboarding-arranque.ts).
  **Regla:** con algo pendiente de confirmar, nada se escribe sin un sí explícito; lo que no es sí ni no es OTRA
  propuesta por confirmar, nunca va directo al dato. Un test de confirmación manda el TEXTO «Sí» con tilde, no la opción.
- **«100.000» parte en «100» y «000», y «000» está en todas las opciones de plata.** La respuesta escrita de la fase
  («Facturo 15.000 al mes») caía en «$0 – $3.000» y se guardaba como diagnóstico sin forma de corregirlo. Y «No hago
  llamadas, vendo por chat» daba «Llamada de venta»: empate a 1, gana la primera, el «no» no cuenta. **Regla:** en una
  pregunta de tramos se lee la cifra y se ubica en su tramo (`tramoDe`); el canal sale de sinónimos con la negación
  quitada (`canalDeTexto`); por parecido, un empate es null y se vuelve a preguntar.
- **El hilo «Onboarding» tenía una carrera que el diseño hacía inevitable.** La pantalla final pide el chat (POST 'hilo')
  y /second-brain también (para quien ya terminó): con un clic o un F5 a tiempo quedaban dos «Onboarding» y dos jefes
  vacíos, o se entraba a uno a medio copiar (2 de 52 mensajes). Lo que lo cierra: una RESERVA con compare-and-set sobre
  el estado (`hiloCreando`, `cambiarSettingSi`; vence a los 2 min), los mensajes en UN insert y `hiloChat` recién al
  final. **Regla:** un recurso que crean dos caminos se reserva antes de crearse, y el puntero se anota al final.
- **Una copia armada con lecturas tolerantes se guarda incompleta para siempre.** Con `leerSesion` caída un instante, el
  «Onboarding» salía sin la conversación de lo que vende; con el estado caído al default, «qué vendes en undefined». Y se
  adoptaba cualquier chat titulado «Onboarding», aunque fuera uno propio del cliente. **Regla:** lo que se copia se lee
  estricto (si falla, no se escribe nada), y lo propio se reconoce por una marca (`contextoDelHilo`), nunca por el título.
- **«Quién está» no es «quién contestó».** Con dos admins, el primero que entraba se llevaba el onboarding de la dueña
  (su nombre, su WhatsApp, lo que vende). Ahora el estado guarda `dueno` al contestar y `hiloDe` al crear el chat; con un
  solo admin activo se le da a ese. Y la proyección de Offer esconde la conversación copiada SÓLO a quien tiene la copia
  (`offerDelOnboardingCopiada(raw, chartKey)`, lib/chat-mako-reglas.ts): para todos, desaparecía del Ops Center del super
  admin mirando, justo lo que Martín pidió arreglar ese día.
- **Una capa que se lee de `sessionStorage` en `useState(true)` la pinta el server en CADA carga.** La entrada de MaKo en
  el teléfono tapaba la pantalla hasta hidratar (1–3 s en un Android lento) y, sin JS, para siempre. Lo que anda: un
  script antes del primer pintado pone `data-entrada-vista` y el CSS la oculta (app/m/_ui/entrada.ts), más una animación
  que la esconde a los 6 s si nada hidrata. **Regla:** «una vez por sesión» no se decide en el estado inicial de React.
- **La guardia anti-inyección no lee documentos enteros.** Un texto de 20.000 caracteres armado con ChatGPT trae «Olvida
  las reglas de siempre…» o un índice «…… 3»: salía 'inyeccion' o 'basura' y a las 3 faltas el onboarding se bloqueaba.
  Arriba de `TOPE_MENSAJE` el texto va como documento y la guardia no lo mira (app/api/offer/route.ts).
- **Pantalla y servidor tienen que normalizar igual.** La pantalla mandaba el link sin leer como `https://www…` y el
  servidor lo buscaba con `texto.includes(u)` en un texto que decía `www…`: se descartaba y MaKo no se enteraba de que no
  lo pudo abrir. Ahora el servidor valida con el mismo `linksDe`.
- **Un tope que cuenta preguntas tiene que contar las de ESA pieza.** El tope de 2 repreguntas contaba el pedido de
  documento y cualquier pregunta del modelo: el precio quedaba «sin dato:» sin que nadie lo preguntara. Cuenta sólo las
  que apuntan a la pieza que falta (`PREGUNTA_POR`, lib/offer-reglas.ts).
- **Las cuotas de la tarjeta no son una suscripción** («12 cuotas sin interés», «MSI», «en un pago o 3 cuotas»): ante la
  duda, único; en el CRM una suscripción se lee como ingreso recurrente. **Y una terminal del CRM no puede decir lo
  contrario**: `{"ganado": "Perdido"}` es un nombre válido para el parser; `contradiceLaTerminal` lo deja de fábrica.
- **Sin `preventDefault`, Chrome abre el archivo soltado y se lleva el onboarding.** En las preguntas de sólo texto, los
  manejadores de arrastrar salían antes de frenar. El archivo se frena siempre; sumarlo es lo que depende de la pregunta.
- **Un test que fija strings exactos de un archivo ajeno se rompe con el refactor de otro chat.** El de la caja copiaba
  líneas de Conversacion.tsx, y la caja única (caja-voz) las movió a app/_chat/CajaChat.tsx: rojo sin nada roto. Ahora
  compara por pieza (regex) y sigue el archivo donde viva la caja.

**La segunda revisión (la misma noche, punta 4eef10c7a): los arreglos rompieron lo que antes andaba.** El bloqueante
quedó resuelto. Pero los arreglos de la fase escrita, hechos contra los casos de la primera revisión, trajeron errores
nuevos que cargaban mal el diagnóstico. El escéptico lo midió corriendo la misma sonda sobre la punta anterior
(88a5ebd05): eran regresiones de la rama, no de producción.
- ⚠️ **Una transformación pensada para lo que escribe el dueño se aplicó también a las OPCIONES.** Borrar lo negado
  sacaba el «no cierran» de «Me entran interesados pero se caen: no agendan… o no cierran». Entonces «tengo leads pero no
  cierran» caía en «Me sobra volumen» por la palabra «leads». **Regla:** lo negado se MARCA (`!cierr`) y empareja con lo
  negado de la opción; y un parser se prueba con las frases que YA andaban, no sólo con las que fallaban.
- **`startsWith('mil')` es true para «millones».** La regex probaba bien «millón» antes que «mil», pero la línea que
  elegía el multiplicador volvía a mirar el prefijo. **Regla:** cuando dos palabras comparten prefijo, la más larga se mira
  primero en TODOS los lugares que las distinguen, no sólo en la regex.
- **«y» une un rango y también dos datos distintos.** «entre 30 y 50 mil» es un rango, y su «mil» vale para las dos puntas.
  «15 mil y tengo 4 clientes» no es un rango: son dos cifras. Rango = dos cifras PEGADAS por y/a/-/hasta. Con cifras
  sueltas vale la única que trae plata o magnitud ($, USD, mil, puntos de miles); con dos así, se vuelve a preguntar.
- **La lista de lo que dice «sí» tiene que aceptar frases enteras.** «Sí, está bien», «Correcto, así se llama» o «Sí, por
  favor» no estaban en la lista, y lo que seguía al «sí» se tomaba como el nombre nuevo. Ahora un sí seguido de palabras
  de acuerdo es un sí. Un sí seguido de otra cosa no adivina: pregunta de nuevo.
- **«Con tarjeta» es el medio de pago, no la forma de cobro.** Con «por mes» o «membresía» es una suscripción. Sólo las
  cuotas de la tarjeta sin nada mensual, «sin interés» o «MSI» son pago único.
- **Lo que esconde la pantalla va DESPUÉS del `await`, no antes.** El fundido arrancaba antes del POST 'hilo'. La capa
  invisible se comía los clics, y el «Entrando…», que está adentro de esa capa, no se veía nunca.
- **La guardia de costo cuenta el trabajo que se hace, no el nombre de la acción.** Un 'turno' con texto largo hace el
  trabajo de un documento (hasta 20 lecturas). Contado sólo como turno, salteaba el tope de documentos. Además se leía el
  texto entero antes de recortarlo a lo que se guarda.

**Sin hacer:** ~~el «+» de la caja del onboarding acepta menos que antes~~ HECHO el 21/10: el onboarding usa la caja ÚNICA
(app/_chat/CajaChat.tsx) con `accept: ACCEPT_IMPORTAR`, y app/offer/CajaDelCentro.tsx se borró; «Fotos» sigue sólo con
imágenes. /m/second-brain crea el hilo pero no lee `?recorrido=`: en el teléfono no hay tutorial. El CRM a medida sigue pidiendo
la propuesta ANTES de responder (bajó a 25 s / 45 s con la red); armarla aparte queda para después.

*20/10/2026, noche, chat «Onboarding» (claude4), rama onboarding-v3.*

## El parser escrito necesita confirmación: tres rondas de reglas abrieron agujeros nuevos cada vez (21/10/2026)

**El síntoma.** Hubo tres revisiones del Cerebro seguidas (20/10 tarde, 20/10 noche, 21/10 madrugada) sobre lo que el
onboarding lee de una respuesta ESCRITA en una pregunta con opciones. Cada ronda cerró los casos de la anterior y abrió
otros con frases igual de comunes:
- **Ronda 1:** «15.000» caía en «$0 – $3.000» por el token «000», y «no hago llamadas» era «Llamada de venta».
- **Ronda 2:** «millones» valía por mil, la negación se aplicaba también a las opciones y «directo» era chat.
- **Ronda 3:** «2 palos» (pesos) se leía en dólares, lo negado valía doble y pisaba el contenido, «web» sola era
  carrito, un «a la semana» suelto multiplicaba lo mensual, «treinta y pico mil» quedaba en «todavía nada», y «Sí, es
  así» proponía el nombre «así».

Cada error se GUARDABA en el diagnóstico con un «Lo tomé como: …» que informaba sin dejar corregir. En producción sólo se
aceptaba la opción exacta: todo esto entraba nuevo.

- ⚠️ **El diagnóstico obvio de la ronda 3 era el equivocado: «2 millones de pesos» no era un bug de «millones».** Los tramos
  son en DÓLARES (lib/fase-diagnostico.ts: «$0 – $3k/mes · $20/día en ads»). El arreglo de la ronda 2 multiplicaba bien,
  pero ignoraba la moneda, y **el test de esa ronda FIJABA el error** (`['unos 2 millones de pesos', 4]`, «Más de $80.000»).
  Un test que fija una lectura puede fijar la lectura mala: la frase de la batería necesita también la respuesta
  verdadera, no la que da el código.
- **La regla (decisión del Cerebro): no hay una cuarta ronda de reglas, hay un toque.** Lo escrito se lee, MaKo muestra
  «Entendí: «…». ¿Es así?» con «Sí, es eso» y las otras opciones, y se guarda recién con ese toque (`opcionPorConfirmar`,
  `elegirOpcion`, lib/onboarding-arranque.ts). Un error de lectura cuesta un clic. Sin una lectura clara (un empate, una
  sola palabra suelta, dos cifras de plata, una moneda que no es el dólar) no se adivina: se muestran las opciones, o se
  pregunta «¿cuánto es más o menos en dólares?». La regla general quedó en AGENTS.md.
- **El seguro se prueba BARRIENDO, no caso por caso.** tests/onboarding-opcion-escrita.test.ts pasa ~30 frases por cada
  pregunta de la fase, el canal y el interés, en los dos modos, y fija que ninguna guarda nada sin el toque. Romper la
  confirmación tira 6 tests.
- **Una rotura que ningún test detecta dice que el código sobra.** Sumar los verbos de relleno («tengo», «hago») a las
  palabras vacías no cambiaba ninguna frase de la batería. Se sacó en vez de inventarle un test.
- **Las listas de lo que ESCRIBE la persona van en un archivo aparte (lib/onboarding-frases.ts).** El guard de voseo
  (tests/puente-panel-copy.test.ts) va por archivo, y marcó «ándale» (¡de México!) y «soles» (la moneda de Perú) adentro de
  lib/onboarding-arranque.ts, que tiene el copy del chat. Excluir ese archivo apagaría el guard sobre el copy real; el
  detector aparte entra en FUERA_DE_ALCANCE con su porqué, como lib/onboarding-troleo.ts. Y el archivo nuevo tiene que
  estar en git (`git add`) antes de correr el guard: lista con git y da «excepciones que ya no apuntan a ningún archivo».
- **El «sí» al nombre pendiente se lee por frase entera y nunca se vuelve el nombre.** «Sí, es así», «sisi», «Vale»,
  «Listo», «es mi negocio» son un sí. Una palabra de acuerdo (o «No, está bien») no reemplaza al nombre que espera: se
  pregunta de nuevo.

**Y la cuarta revisión (punta 2fbd0f3a5): la red funcionaba, los agujeros estaban alrededor.**
- ⚠️ **Un guard de pestaña vieja que compara el TEXTO DEL BOTÓN no sirve si todas las confirmaciones tienen el mismo
  botón.** «Sí, es eso» es igual en todas, así que un toque viejo, o un «sí» escrito, confirmaba la lectura que el server
  tenía AHORA, aunque esa pantalla nunca la hubiera mostrado. **Regla:** el toque y lo escrito viajan con la PREGUNTA que
  contestan (`preguntaQueContesta`, app/onboarding/arranque-ui.ts), y el server la compara con la suya.
- **Dos lectores de la misma frase con significados opuestos.** Para que «es mi marca personal» confirmara el nombre, se
  sumó a la lista del sí. Pero RE_MI_NOMBRE lee esa misma frase como «uso mi nombre». Con el pendiente mal leído «Vendo
  ropa», confirmaba «Vendo ropa». **Regla:** antes de sumar una frase a una lista de lectura, buscar si otra regex del
  mismo archivo ya la lee (`git grep` de la frase). Lo que sólo nombra lo preguntado («es mi negocio») vale como sí
  únicamente detrás de un sí explícito (`NOMBRA_LO_PREGUNTADO`).
- **La duda de la moneda la tumbó el escéptico, y con razón.** «$ 150.000» no es un error de lectura: las opciones que ve
  la persona dicen «$» sin «USD», así que leer «$» como la moneda de los tramos es coherente con lo que se muestra. El
  problema, si lo hay, son las etiquetas de lib/fase-diagnostico.ts, que vienen de antes. Lo que sí se pregunta en dólares
  es lo que dice otra moneda: pesos, «lucas», «palos».
- **Un insert en lote con `DEFAULT now()` deja la MISMA hora en todas las filas.** Postgres lo corre en una transacción, y
  si la lectura ordena sólo por esa columna, los empates salen en el orden físico de la tabla. El chat «Onboarding» podía
  mostrar la mitad de la conversación antes del saludo. **Regla:** al copiar en lote, cada fila lleva su hora creciente.
- **Lo que se lee y no se ve también necesita el toque: el tipo de cobro del producto.** Se guardaba sin que nadie lo
  mirara. El PDF muestra el texto del precio, no la lectura, así que su «Sí, está correcto» no confirmaba nada. Ahora hay
  una pregunta propia (etapa 'cobro').
- **Un copy que promete una acción necesita código que la haga.** «Lo anoto» después de un «no» al PDF no anotaba nada:
  ahora la nota va a onboarding.encuesta (`pdfNota`). Y el nombre de la persona leído con reglas pisaba el que trajo Google;
  ahora sólo llena un perfil sin nombre.

**Y la quinta (punta c7226ab77): el arreglo de la cuarta cortaba nombres reales.**
- ⚠️ **Una palabra de acuerdo no confirma un pendiente, pero tampoco puede impedir que un NOMBRE sea esa palabra.** Para
  que «Es mi negocio» no reemplazara al pendiente, la cuarta ronda cortaba toda palabra de acuerdo, y el corte quedó
  valiendo también SIN pendiente. «Claro», «Listo», «Tal Cual», «Simón», «Órale» o «Mi Negocio» son negocios reales, y
  quedaban en un error en bucle que no decía por qué; ni «Se llama Tal Cual» salía, porque «tal cual» está en DICE_SI.
  **Regla:** con un pendiente, la palabra de acuerdo es un sí o se vuelve a preguntar; sin pendiente no hay nada que
  confirmar, así que se PROPONE y el toque decide. Un nombre presentado («se llama», «el nombre es», entre comillas)
  nunca se corta. Con el toque en su lugar, cortar por palabra sobra: es otra lista que no termina.
- **Lo mismo con el nombre de la persona.** Con el perfil vacío o en un email (el alta de customer-success), «Gracias»,
  «Dale» o «Jaja» iban a usuarios.nombre. Sumarlas a las palabras que no son nombre era otra lista, y «Dale» es un
  nombre. Ahora lo que va al perfil se confirma («¿Te llamo «Ana»?», `nombrePorConfirmar`); con un nombre de verdad en el
  perfil lo leído sólo saluda y no hace falta.
- **El PDF tampoco se lee con reglas.** La cuarta ronda sumó «salvo», «pero», «aunque» a una lista, y la quinta encontró
  «solo que», «lo único», «en vez de», «corregí»… Ahora un sí o un no sueltos valen, y lo demás pasa por «¿Lo tomo como
  que falta algo?» (`pdfPorConfirmar`). Ojo con la doble negación: «No está mal» es un sí, y sin la coma es igual a «No,
  está mal». `siONo` la devuelve como ni sí ni no, y decide el toque.
- ⚠️ **Una nota que nadie lee no está «anotada».** La cuarta ronda arregló la ESCRITURA de `pdfNota` y dio el «lo anoto»
  por cumplido, pero ningún lector la tomaba: ni la tabla del super admin (`llegadaDe`) ni `ver_estado_onboarding`.
  **Regla:** al escribir un dato para alguien, `git grep` de sus LECTORES en el mismo cambio. Ahora la tabla de clientes
  marca «Oferta a corregir» (con la nota al pasar el mouse y en el CSV), y la API de MaKo la devuelve con qué hacer.
- **Un campo nuevo que el server exige deja en bucle a la pestaña abierta durante el despliegue.** La pregunta que
  contesta viaja desde la cuarta ronda, pero el JS de antes no la manda: cada toque daba «La pregunta cambió» con la misma
  vista, sin salida. **Regla:** el server distingue «no lo mandó» (JS viejo: «recarga la página», `RECARGA_LA_PAGINA`) de
  «mandó otro» (otra pestaña). Va en AGENTS.md.
- **Lo que no se sabe guardar no se propone.** Lo anual o semanal se proponía como «Suscripción mensual», y el producto
  sólo sabe cobrar único o mensual: las dos opciones eran falsas, y el botón principal lo cobraba cada mes. Ahora la
  lectura lleva su `periodo` y la etapa pregunta sin proponer (`cobroSinPropuesta`).
- **La caja única cambia de botón en el mismo lugar.** Al mandar, el ➤ se vuelve micrófono, y un doble toque grababa (o
  pedía permiso del micrófono a un cliente nuevo). Justo después de mandar el micrófono queda apagado 600 ms (`recien`,
  app/_chat/CajaChat.tsx), y el onboarding no deja grabar ni sumar archivos mientras MaKo contesta (`voz.apagada`,
  `puede`): esa respuesta puede cerrar la etapa, y lo juntado en el medio se perdía sin aviso.

**Y la sexta (punta a0cdcfcc6): el toque nuevo del PDF tenía la polaridad al revés.**
- ⚠️ **Una confirmación con la polaridad al revés que la pregunta anterior no se puede leer con DICE_SI.** La quinta
  preguntaba «¿Lo tomo como que falta algo?», donde «sí» quiere decir que falta, y leía lo escrito con `siONo`. DICE_SI
  trae «perfecto», «está bien», «muy bien», «genial», que son la respuesta natural de quien dice que el PDF está BIEN:
  «Está perfecto» o «👍» quedaban anotados como corrección, y el super admin veía «Oferta a corregir: Todo perfecto».
  **Regla:** la confirmación tiene la misma polaridad que la pregunta que confirma («Escribiste «…». ¿Lo tomo como que
  está todo bien?», con el sí primero), y ahí deciden sólo los dos botones y un sí o un no PELADOS (`siONoPelado`). Lo
  demás se anota y se vuelve a preguntar. Va en AGENTS.md.
- **La pregunta de un toque tiene que llevar lo que confirma.** El guard de pestaña vieja compara el texto de la pregunta.
  Una pregunta fija es igual para cualquier texto, y un toque viejo confirmaba una corrección que esa pantalla no mostró.
- **Lo escrito a un toque se SUMA, no pisa.** «Sí, el precio» reemplazaba a «Todo bien salvo el precio, que es 200 USD», y
  el 200 se perdía. Ahora lo escrito al PDF es una lista (`pdfEscritas`, que reemplazó a `pdfPorConfirmar`), y la nota
  junta todo (`notaDelPdf`).
- **Un «no» sin detalle también es una nota.** El camino más común, tocar «No, faltan cosas», no dejaba nada: pdfNota
  salía de lo escrito. Ahora queda `PDF_SIN_DETALLE`, la tabla marca «Oferta a corregir» y `ver_estado_onboarding` le dice
  a MaKo que pregunte qué es. No se pregunta en el onboarding: el pedido de Martín (18/10) es «lo anotas y seguimos».
- **El orden de las reglas es una decisión.** La quinta puso lo anual antes que las cuotas, y «Programa anual: 12 cuotas
  de USD 99» ya no podía cargarse como la suscripción de 12 meses. Las cuotas van primero.
- **Una lista de corte también es una lista.** PALABRAS_NO_NOMBRE corta en «su», «mi», «una», «tu», «en», y «Su Lin» o
  «Mi Young» quedaban en «No te entendí» en bucle (ya en producción). Si el corte deja vacío lo que tiene letras, se
  propone con el toque (`nombreSinCortar`), con cualquier perfil; una pregunta o un «Ok» se siguen pidiendo de nuevo.
- **«Sólo saluda» hay que verificarlo en TODOS los lugares a donde va el dato.** Con un perfil de verdad, el nombre leído
  sin toque no iba al perfil, pero la etapa del teléfono lo copiaba a user_nombre, que firma los reportes. Ahora va el
  nombre del perfil. Antes de decir que un dato «sólo se muestra», hay que hacer `git grep` de cada lugar donde se lee.
- **Con un pendiente, «No, Pedro» y «Sí, soy Ana» se leen como en el negocio**: el sí o el no del principio y el nombre
  de después. El mismo nombre escrito otra vez confirma. «Sí, no» no es un sí, ni en el nombre ni en el negocio (con la
  persona pendiente guardaba su nombre como el del negocio).
- **Un CSV con texto del cliente puede llevar una fórmula.** `=HYPERLINK(…)` en la nota del PDF entraba como fórmula en
  Excel. La exportación de clientes antepone «'» a lo que empieza con = + - @. Las otras exportaciones a CSV están en
  hallazgos-seguridad.

**Y la séptima (punta 689f75560, entró sin altos ni medios): seis bajos.**
- ⚠️ **Con un nombre esperando, una palabra que es sí y también nombre no puede confirmar.** La tercera revisión hizo un sí
  de «Vale», «Listo», «Simón» o «Ándale»; la quinta dijo que también son nombres reales. Juntas, con «¿Te llamo «Cómo
  Estás»?» escribir «Simón» para corregir guardaba «Cómo Estás». **Regla:** con un pendiente, lo que empieza con una
  palabra de `PUEDE_SER_NOMBRE` es una 'duda' (`siAlPendiente`). No confirma ni reemplaza: se pregunta cuál («Escribe «Se
  llama Listo». Si es «Vendo ropa», toca…»). El mismo nombre otra vez confirma. «Sí, …», «Ok», «Correcto» o «Está bien»
  siguen siendo un sí. Las dos revisiones tenían razón a la vez, y la salida fue preguntar, no elegir una.
- **Mover una regla arrastra a sus vecinas.** La sexta puso las cuotas antes que lo anual («Programa anual: 12 cuotas»),
  pero movió también lo semanal, y «8 cuotas semanales» volvió a ser «Suscripción de 8 meses». Ahora lo semanal va antes y
  las cuotas que dicen otra periodicidad («2 pagos anuales») no son meses.
- **El sí o no «pelado» del toque era demasiado pelado.** Sólo valían «sí» y «no», y «Ok», «Dale», «👍» o «Nop» se anotaban
  y se volvía a preguntar sin fin. Ahora cuentan los sí y no de una palabra (`SI_DE_UNA_PALABRA`, `NO_DE_UNA_PALABRA`, sin
  el color de piel del emoji), y lo escrito tiene tope (`PDF_TOPE_ESCRITAS`: al pasarlo, se pide el botón).
- **Una instrucción atada a una marca exacta no cubre lo que dice lo mismo con otras palabras.** MaKo preguntaba «qué
  falta» sólo si la nota era `PDF_SIN_DETALLE`, y no con «No me convence». Ahora la instrucción va siempre.
- **El mismo nombre otra vez tiene que leerse igual que la primera vez.** «Su Lin» se propuso con `nombreSinCortar`, pero
  al escribirlo de nuevo se comparaba sólo con `extraerNombre`, que lo deja vacío.
- **Un texto que se repite en una pregunta se corta por punto de código, no por unidad UTF-16.** `slice(0, 60)` partía un
  emoji y dejaba medio par suelto, que se ve «�» y que Postgres rechaza al copiar la conversación al chat «Onboarding».
  Ahora `cortar` corta por punto de código, también en `limpiarRespuesta` y en los nombres.

**Y la octava (punta 108b2f270): dos regresiones contra producción, por arreglar de más.**
- ⚠️ **La duda es de la PALABRA SUELTA, no de la frase que empieza con ella.** La séptima puso en duda todo lo que
  EMPEZABA con «Claro», «Listo» o «Genial», y «Claro, así se llama» o «Listo, es correcto», que en producción confirmaban,
  dejaron de hacerlo. Peor: el error mandaba escribir «Se llama Claro, así se llama», y eso proponía un nombre basura.
  **Regla:** la duda es sólo para un texto hecho únicamente de palabras de `PUEDE_SER_NOMBRE`. Si detrás viene un sí que
  no es nombre, es un sí. La entrada de la séptima, más arriba, decía «lo que empieza con»: era la regla mal escrita.
- ⚠️ **Una periodicidad cuenta sólo si va pegada al pago, no a la descripción del servicio.** Para que «8 cuotas
  semanales» no fueran meses, la séptima buscó «semanal» en todo el precio, y «3 cuotas mensuales de USD 300, con una
  llamada semanal» pasó a «cobras por semana»: los 3 meses ya no se podían elegir. Ahora vale «N cuotas (de USD X)
  semanales», «USD 50 por semana», «membresía anual» o «pago semanal» (`RE_CUOTAS_CON`, `RE_PEGADO`). Lo de una
  sesión, una llamada o una clase no cuenta. Con «Programa anual USD 1.500», «anual» describe el programa y se propone
  «Pago único».
- **Una periodicidad sin camino propio no se propone.** Lo trimestral, semestral, bimestral o quincenal se proponía
  como «Pago único» o «Suscripción mensual». Ahora va con su `periodo` y se pregunta, como lo anual o lo semanal.
- **Un mensaje de error no dice «lo anoté» si no anotó nada.** Pasado el tope del PDF, lo escrito se descartaba con un
  «Ya lo anoté». Ahora se suma a lo último hasta que no entra, y entonces sólo se pide el botón.
- **Lo que enseña la ronda:** las dos regresiones salieron de arreglar un caso con una regla más ancha que el caso. La
  comparación contra producción (las mismas frases en las dos puntas, con diff) las encontró. Una prueba de la punta sola
  no las ve.

**Y la novena (punta 82321e397): la cuarta vuelta de reglas sobre la periodicidad. Se cambió la red.**
- ⚠️ **Cuatro vueltas de reglas sobre la periodicidad, y cada una movió casos de lugar.** La quinta leyó lo anual, la
  sexta puso las cuotas antes, la séptima movió lo semanal, la octava lo pegó al pago, y en la novena «1 a 1 semanal» o
  «3x semana» volvieron a ganar a «3 cuotas mensuales»: un número pelado parecía un monto. Cada vez, lo que se perdía era
  la OPCIÓN correcta, no sólo la lectura, porque la lectura decidía qué opciones se mostraban. **Regla (decisión del
  Cerebro):** las opciones del cobro son SIEMPRE todas las lecturas posibles (`opcionesDeCobro`): «Pago único»,
  «Suscripción mensual (sin fin)» y una «Suscripción de N meses» por cada N junto a cuotas, pagos, meses o mensualidades.
  La lectura sólo ORDENA (va primera y arma el «Entendí»), nunca saca una. Lo que el producto no sabe cobrar se dice sin
  recomendar nada. Medido con las 204 frases de la sonda del Cerebro: la propuesta de producción está entre las opciones
  en las 204. Es la misma salida que la del parser escrito (arriba): cuando las reglas no convergen, se cambia la red.
- **«Suscripción mensual» se leía como «los meses de las cuotas».** Una suscripción sin meses se cobra todos los meses,
  sin fin, y la persona la elegía para «3 cuotas mensuales». Ahora la etiqueta lo dice: «Suscripción mensual (sin fin)».
- **Si el tope suma a lo último, la pregunta tiene que cambiar.** La pregunta del PDF repetía los primeros 60 caracteres
  de lo último, y al sumarle algo quedaba igual: el guard de pestaña vieja no veía el cambio. Ahora repite lo último que
  se sumó.

**Y la décima (punta 5d353db16): la red estaba bien; la entrada, no.**
- ⚠️ **Los números en letras se normalizan ANTES de leer, una vez.** La novena prometía «la opción correcta está siempre»,
  y con «Tres cuotas mensuales de USD 300» la única suscripción ofrecida era la sin fin, propuesta primera. Es justo el
  caso que motivó el «(sin fin)». La red juntaba sólo dígitos pegados a la palabra. Sumar «tres|seis|doce…» a cada regex
  hubiera sido otra lista. **Regla:** se cambia la ENTRADA: `precioEnDigitos` pasa el precio a cifras una sola vez
  (reusa `conNumerosEnLetras`, la de la facturación), y lo leen `cobroDelPrecio` y `opcionesDeCobro`. La red también
  junta las enumeraciones («3, 6 o 12 cuotas»: las tres), «10 x USD 120», «cuotas: 3» y «en 3 partes». Las de cuotas van
  antes que las de «meses», sin tope.
- ⚠️ **Una lectura POR DEFECTO no es una lectura, y no se propone.** «Renovación anual de USD 1.500», «Membresía USD 29»
  o «Suscripción de 6 meses» no tenían ninguna señal que la lectura entendiera, caían al `return unico` del final, y eso
  se proponía como «Entendí que cobras así: Pago único», y un «Sí» lo guardaba. **Regla:** la caída sin señal se marca
  (`porDefecto`) y se pregunta sin recomendar («No me queda claro cómo cobras»): orden fijo y un sí no elige
  (`recomienda`). Sólo se propone lo que salió de una señal: pago único, contado, cuotas, mensual o lo periódico negado.
  Con eso, un precio pelado («USD 997») también pregunta: un toque más, pero ninguna propuesta inventada.
- **La guarda de pestaña vieja reconoce las confirmaciones por el TEXTO DEL BOTÓN, y el cobro perdió su «Sí, es eso».**
  Una pantalla sin la pregunta volvía a poder guardar con un «Sí». Ahora el cobro con lectura recomendada cuenta como
  confirmación por la etapa.
- **El separador de lo sumado no puede ser algo que la persona escriba.** « · » partía también lo que escribió («Precio:
  200 · Garantía: 30 días» se citaba a medias). Ahora es un salto de línea (`SUMA_PDF`), que `limpiarRespuesta` aplana en
  lo escrito. Y la pregunta cuenta lo sumado («(y 1 cosa más)»): cambia aunque lo nuevo empiece igual que lo anterior.
- **Un caso que está siempre por construcción no prueba nada.** 7 de los 20 precios del test de la novena tenían como
  respuesta «Pago único» o la mensual, que siempre están. Se cambiaron por casos que pueden fallar: en letras,
  enumeraciones, una N mayor a 12 y una segunda N con la lectura semanal. Y una medición contra la lectura vieja de
  producción («está entre las opciones en las 204») no ve lo que producción también hacía mal: se mide contra la
  respuesta CORRECTA.

**Y la undécima (punta 1106e8c16): la red ya estaba; la lectura no leía lo que leía la red.**
- ⚠️ **Pasar el texto a dígitos arrastra a las letras todo defecto que la lectura ya tenía con dígitos.** «2 meses
  gratis» ya se proponía como el fin de la suscripción en producción; con `precioEnDigitos`, «dos meses gratis» también.
  **Regla:** los meses se PROPONEN sólo pegados a un cobro («3 meses de USD 300», «USD 300 por mes durante 3 meses») o al
  plazo del plan con lo mensual dicho («Contrato de 12 meses, USD 100 por mes», `RE_MESES_DEL_PLAN`), nunca los de
  regalo, prueba o garantía. Los demás «N meses» sólo suman la opción.
- ⚠️ **La lectura y la red tienen que usar el MISMO extractor de N.** Si no, la opción correcta está pero el «Sí» guarda
  otra: «10 x USD 120 mensuales» tenía la de 10 meses entre las opciones y proponía la sin fin. Ahora `nsDelPrecio` arma
  las N una vez, y la lectura toma la primera de las cuotas.
- **Un número que lleva moneda nunca es una N de cobro**, y un número pelado no es un monto. «USD 47 o 2 pagos» traía «de
  47 meses», y «1:1 semanal» o «3 x semana» pegaban una periodicidad al pago y le ganaban a las cuotas. Ahora las N miran
  la moneda de los dos lados, y lo pegado al pago exige un monto con moneda (`MONTO_CON_MONEDA`).
- **El borde de una palabra es cualquier cosa que no sea letra.** «(seis cuotas» no se convertía porque sólo se separaba
  la puntuación DESPUÉS de una letra.
- **Una señal dicha de otra forma sigue siendo una señal.** «Un pago de USD 900», «cuota única», «de por vida», «una
  vez», «precio único» (`UNICO_DICHO`) y «no se paga en cuotas», «cuotas no» (`NEGO_LO_PERIODICO`) caían en la lectura por
  defecto o en la sin fin.
- **Medido contra la respuesta correcta**, con las 570 frases de la sonda del Cerebro que la traen: falta la opción
  correcta en 0 (producción: 95), un «Sí» guarda mal en 6 (producción: 122) y bien en 431 (producción: 424). Ningún «Sí»
  malo es nuevo. Lo que producción proponía bien y ahora pregunta son 83 precios sin señal de cobro: con etiqueta
  («Precio:», «Valor:», «Desde»), por sesión o por hora, rangos, otras monedas o meses de acceso. Es la familia del
  precio pelado, y es la regla de la décima.

**Florencia otra vez (21/10, «cliente roto»): lo que el onboarding escribe, el cliente tiene que poder corregirlo.**
- ⚠️ **Un dato que escribe la plataforma necesita un lugar donde el cliente lo corrija.** El nombre «mi marca personal:
  Florencia Ayelen Carballo» lo escribió el onboarding del 18/10, y ella no tenía dónde cambiarlo: workspaces.nombre sólo
  se editaba desde General (/configuraciones), que es del super admin. Arreglar el lector (el onboarding de hoy confirma
  el nombre) no arregla a quien ya pasó. Ahora está «Tu negocio» (/configuraciones/negocio), primera sección para el
  cliente, y lo cambia su admin (lib/nombre-negocio.ts, app/configuraciones/negocio-actions.ts).
- **La reparación de un dato real no adivina.** Su precio dice «USD/mes (6 cuotas típicas)» y también «pago único» para
  los servicios puntuales, y la lectura da pago único. El script (side-session-notes/…/feedback-20-10/reparar-ws21-v2.ts)
  no toca el nombre (lo elige ella) y cambia el tipo de cobro sólo si quien lo corre dice cuál (`--meses=6` o
  `--mensual`). Sin `--aplicar` sólo lee.
- **Su chat «Onboarding» nunca se creó** (`hiloChat` vacío en su estado): terminó el 18/10, antes de que existiera, y ese
  chat se crea cuando ella entra. Su conversación de Offer (sesión 14) sí guarda las preguntas de MaKo; las del nombre y
  el negocio se arman al vuelo desde el estado y no se guardan en ningún lado.
- **Medido en la base (21/10, noche): el ws21 tiene CERO chats en chart_sessions.** Lo único que su Ops Center puede
  mostrar es la proyección de Offer (`hiloDeOffer`), y ésa tiene las 33 filas con las preguntas de MaKo. Lo que falta
  son las preguntas Y las respuestas del arranque (nombre, negocio, fase, cómo llegó, interés, cobro). Además,
  `mensajesDeOffer` descartaba la fila 3, el documento que ella mandó como respuesta (texto vacío y `adjuntos`), y
  `mensajesDelHilo` lo escribe como «Adjunto: …»: eran dos mapeos del mismo dato.

**Las preguntas del arranque, guardadas (21/10, noche, chat «Onboarding», claude3).**
- **Medido en pantalla, no supuesto** (Chrome de Martín, `/api/auth/me` = super admin, `/second-brain?ws=21`): la barra
  muestra «Second Brain» vacío (es el de Martín), «Offer › Mi oferta» y «Antes» sin nada. «Mi oferta»
  (`/api/mako/chat?offerId=14`) trae 32 mensajes que alternan bien, con todas las preguntas de Offer. ⚠️ **El diagnóstico
  obvio («la proyección pierde las preguntas» o «dibuja sólo `role: user`») era el equivocado.** Lo que faltaba era otra
  cosa: el arranque entero, preguntas y respuestas, porque nunca se guardó. La conversación empezaba en «¿Tienes un
  documento de tu oferta…?». Y el documento que ella mandó no se veía, así que quedaban dos preguntas de MaKo seguidas.
- **Ahora se guarda como pasó**: lib/onboarding-historial.ts anota lo que MaKo dice la primera vez que la pantalla lo
  dibuja, y lo que la persona manda, tal cual. Se anota en cada respuesta (la ruta: `anotarRespuesta` y
  `vistaArranque({ anotar: true })`), nunca al mirar. La lectura es estricta y se escribe con compare-and-set. El Ops Center (`hiloDeOffer`) y el chat «Onboarding»
  (`mensajesParaElHilo`) lo juntan por hora con la conversación de Offer. Regla general en AGENTS.md («Una conversación
  que se le mostró a alguien es un HECHO»).
- ⚠️ **No va en los `mensajes` de Offer**, aunque era lo pedido («en la sesión de Offer»). Esa lista maneja el
  diagnóstico de Offer: el primer turno (`primero.era`), qué fase ya contestó (`estadoDiagnostico`), el último mensaje y
  lo que lee el modelo. Y Offer la reescribe entera en cada turno. Una pregunta del arranque ahí adentro Offer la toma
  como suya. Va en `onboarding.historial`, atada por `sesionId`.
- ⚠️ **La «trampa» de `hechosDelArranque` era a medias.** `getCapaActual` lee la capa del WORKSPACE que está en contexto
  (`workspaces.capa`), no la de quien mira. Y el perfil (`nombreCuenta`) no lo usa `mensajesDeArranque`, sólo
  `leerRespuesta`. Lo que sí hay que mirar al reconstruir es que el ws esté en contexto (`runWithWorkspace`).
- ⚠️ **Lo que tapó la revisión adversarial (21/10, noche), y cómo quedó:**
  - **Una lectura que cae cambia lo que se dibuja, y lo dibujado quedaba para siempre.** Con el estado leído tolerante
    caído, se anotaba «Un gusto, . ¿Cómo se llama tu negocio?». Con la capa caída a «completa», el modo plan se
    dibujaba como oferta. Con la fase caída, salían preguntas que no se hicieron. Ahora, para anotar, el estado se lee
    estricto, y lo que decide el dibujo (capa, diagnóstico, estado del onboarding, conversación) se relee estricto y
    tiene que dar lo mismo (`hechosConfirmados`).
  - ⚠️ **El primer guard (`faseCaida`) era código muerto:** `getSetting` nunca tira, así que su `.catch` no se ejecutaba.
    La regla quedó en AGENTS.md («Una lectura que cae al DEFAULT…»).
  - **Las respuestas a las confirmaciones se perdían.** La pantalla dibuja el dato CONFIRMADO («Acme»), no el toque
    («Sí, se llama así»): anotar desde lo dibujado dejaba dos preguntas seguidas. Ahora, en vivo, lo de MaKo sale de lo
    dibujado y lo de la persona sale de lo que MANDÓ (`anotarRespuesta`, con el texto de la opción que tocó). La pregunta
    que vuelve («Ver otros tipos», «No, lo escribo de nuevo», «Cambiar número») se anota otra vez.
  - **Con el cierre anotado, el historial se congela**: una pestaña vieja o el arreglo del nombre del ws21 no le suman
    variantes. Pasado el tope no se anota más (antes tiraba lo más viejo: el saludo y el nombre). Y lo que no se
    entiende entero no se pisa (`leerHistorial(…, { estricto: true })`).
  - ⚠️ **Segunda revisión (22/10): confirmar con el `h` de ANTES de una escritura da falso justo cuando la respuesta
    escribe lo que se compara.** La respuesta que cierra la fase guarda el diagnóstico, y `hechosConfirmados` corrido
    después ya no coincidía con `h`: esa respuesta no se anotaba nunca, en ningún onboarding. Ahora se confirma antes de
    escribir nada y se pasa el resultado.
  - **El último mensaje de MaKo no siempre es una pregunta abierta.** En el cierre ya tiene su respuesta dibujada
    («Listo, ya lo cargué.», «Ahora no»), y la regla de «la pregunta que vuelve» lo duplicaba. La pregunta abierta es el
    último mensaje de la vista, y sólo si es de MaKo. Con el teléfono ya verificado no se manda código, pero la
    conversación lo dibuja como cargado: se anota igual, con su respuesta.
  - El test que cuenta es el recorrido entero como lo corre la ruta (`leerRespuesta` en cada etapa, con «Ver otros
    tipos», «Cambiar número» y «Ahora no»), y no un salto del PDF al final: el salto pasaba con diez preguntas sin respuesta.
- **La reconstrucción** (scripts/reconstruir-historial-onboarding.mts, en seco por defecto) alcanzó 4 negocios: ws3
  (prueba), 20, 21 y 22, todos terminados. Lo de antes de Offer va justo antes de su primer mensaje. Lo de después va
  antes de que se cerrara el onboarding. Todo lleva la marca `reconstruido`, que en el Ops Center ve sólo el super admin
  («Reconstruido: …»). Los textos son los de hoy, no los del día en que pasó. Un negocio que ya tiene historial no se
  toca, así que se puede volver a correr después del deploy. ⚠️ **Va ANTES del script que arregla el nombre del ws21**,
  porque ése cambia `onboarding.arranque.negocio`, y armado después diría que ella contestó el nombre nuevo.
- **«No veo el chat de ONBOARDING» (Martín, 21/10 ~23:00).** El chat «Onboarding» es de la clienta (chart_sessions con su
  chart_key) y el super admin que mira un ws ve SUS chats, no los de ella. Por eso no aparecía aunque existiera. Ahora la
  conversación del onboarding se lista con el título «Onboarding» para quien no tiene su copia (`chatsDeOffer`), y trae el
  arranque entero. A Florencia, el suyo se le crea en su próxima visita al Ops Center, ya desde el historial.
- **Los audios, medidos (ws21):** 7 de sus 16 respuestas fueron por voz, y los 7 audios están guardados (sesión 14,
  `mensajes[].audio.path`, y los 7 archivos en archivero/21/offer/). No se perdió ninguno. En el arranque no hay audios
  que perder: mientras pregunta el arranque el micrófono está apagado (`voz={arranque.manda ? undefined : …}` en
  app/offer/OfferApp.tsx). Lo que faltaba era MOSTRARLOS: `mensajesDeOffer` pasaba sólo la transcripción, y la copia al
  chat «Onboarding» guardaba sólo texto. Ahora `MensajeChat.audio = { url, secs }`, con la URL de /api/offer/audio sin el
  `?ws=` (la pantalla le pone `conWs`). En chart_chats queda `bloques: [{ k: 'audio', sesion, mensaje, secs }]`, sin ruta
  de Storage: la ruta de Offer la vuelve a buscar con su puerta.
- **Sin hacer:**
  - El reproductor en la burbuja, que lo hace el chat «Ops Center». Hasta entonces el audio llega en los datos pero no se
    ve: `aMensaje` (app/m/mako/chat-ui.ts) no copia `audio`, y `NotaDeVoz` usa la URL sin `conWs`, así que el super admin
    mirando recibiría 403.
  - En modo 'plan' (sin Offer) el historial se guarda pero ningún hilo del Ops Center se lo muestra al super admin,
    porque la proyección cuelga de la conversación de Offer. Vive en lib/chat-mako-indice.ts. Medido el 22/10: de 16
    negocios, sólo dos están en modo plan, el ws5 (pausado) y el ws9 (el de Martín). Ningún cliente activo: no se hizo.
  - La proyección le muestra a cualquier admin del negocio el WhatsApp de los avisos que cargó el dueño. Antes eso
    estaba sólo en el chat «Onboarding» del dueño. Es el contacto del negocio, pero queda anotado.
  - ~~El doble toque CRUZADO~~ (hecho el 22/10): dos POST del mismo toque que leen el estado de antes, donde el `listo`
    del primero ya anotó la pregunta siguiente. Mirar los dos últimos anotados no alcanzaba. Ahora se busca la ÚLTIMA vez
    que se anotó esa pregunta: si la sigue esa misma respuesta y ninguna otra, no se anota. Una pregunta que se volvió a
    hacer tiene su última vez después de esa respuesta, así que contestarla igual sí se anota.

**Sin hacer:** «Vendo 20 a 500 dólares» se sigue leyendo como un rango; la confirmación lo muestra y se corrige con un
toque. Las etiquetas de los tramos dicen «$» sin «USD» (lib/fase-diagnostico.ts): es una decisión de copy, no de este
chat. Vive en lib/onboarding-arranque.ts (`cifraDe`). Cobrar por año o por semana necesita un intervalo en el producto
(lib/productos.ts sólo tiene único y mensual). La nota del PDF no llega a la conversación de Offer, que es donde se
trabaja la oferta: la ven el super admin y MaKo cuando la busca. Al pasar de lo que vende al PDF, CajaChat cambia de
árbol (con voz → sin voz) y el campo se vuelve a montar: se pierde el foco y en el teléfono se cierra el teclado.

*21/10/2026, chat «Onboarding» (claude4), rama onboarding-v3.*

## Un documento de Offer pisaba el perfil del negocio (22/10/2026, chat «Offer»)

El brief (`mako.onboarding.answers`) se escribía también desde Offer: cada archivo subido en el chat pasa por El Archivero
y `answersConDocumento` sumaba sus claves con «el más nuevo gana». Un documento de Offer describe la oferta que se
analiza, no el negocio: el ws1 (Mauricio) subió su Sprint, una oferta de entrada, y su perfil quedó con el Sprint como
oferta principal y su avatar (04:08 UTC). Desde el 22/10 sólo llena lo que el perfil no tiene. La regla para quien
escriba el brief desde otra tab: una feature que analiza UNA cosa no escribe el perfil del negocio con lo de esa cosa.
Detalle en docs/hallazgos-offer.md → «Un archivo subido en Offer pisaba el perfil del negocio».

## Ángulos: la recomendación de formatos se sacó (23/10/2026)

Lo pidió el Cerebro, textual: «O lo enganchás a quien debería leerlo, o se saca el botón: pagar IA por un adorno no
va». Se midió antes de elegir, y **la medición decidió**:

- **0 negocios** tienen el setting `mako.formatos_recom`, y la generación («Elegir formatos de creativo de la
  biblioteca», feature `angulos-formatos`) tiene **0 llamadas en toda la historia** de `anthropic_usage`. Nadie apretó
  el botón nunca. El «paga IA» era un riesgo, no un gasto.
- Lo que SÍ se usa es elegir el formato POR ANUNCIO (`elegirAngulo`): 6 negocios lo tienen en todas sus celdas.
- **Engancharla no sumaba nada.** El prompt de `elegirAngulo` ya recibe el avatar, la razón, el copy y el entregable, que
  es todo lo que usaba la recomendación (perfil, razones y entregable). Hacerla entrada del formato por anuncio habría
  agregado un paso pago para darle al modelo lo que ya tenía.

Se sacó entera: `recomendarFormatos`, `get/setRecomendaciones`, sus prompts, el setting, el POST de
`/api/onboarding/formatos`, el botón de `FormatosView` y la operación `recomendar_formatos_creativo` de la API (con su ruta
REST y el helper `conTope`, que sólo usaba ella). Ángulos muestra la biblioteca con **cuántos anuncios de la matriz usan
cada formato**, sin IA. La cuenta es UNA, `usosPorFormato` (lib/angulos-data.ts), y la leen la vista, el grafo y
`listar_formatos_creativo`: con dos cuentas, MaKo dice «3 anuncios usan Comparación» y la pantalla 2.

**La regla que queda:** una generación con IA cuyo resultado sólo se DIBUJA se mide en producción (el setting y las
llamadas) antes de decidir si se engancha o se saca. «Pagar IA por un adorno» se resuelve con dos SELECT, no con una
opinión.

**Lo que no avisaba nadie:** la descripción de `listar_formatos_creativo` y la nota de su runner MANDABAN a
`recomendar_formatos_creativo`. Si se borraba sólo la operación, el modelo iba a buscar una herramienta que no existe, y
ningún test lo cazaba. Ahora `OPERACIONES_RETIRADAS` (tests/angulos-sin-recomendacion.test.ts) lo frena: ver
docs/hallazgos-api-mako.md.

**La cuenta corta como la Matriz, no como la base** (lo encontró la verificación del mismo día). Contar las celdas de
`mako.razones` parece lo obvio, y miente: **borrar un avatar no borra sus razones** (`borrarAvatar`, la acción «guardar»
de /api/onboarding/avatares) y regenerar con menos avatares deja ids sueltos (`preservarIds` asigna por posición). La
Matriz y el teléfono sólo dibujan las celdas de un avatar que existe (`avatares.map` en MatrizView, `gruposDeAnuncios`),
así que con una huérfana la vista decía «En 3 anuncios» y la Matriz mostraba 2 tarjetas. Ahora la vista y
`listar_formatos_creativo` le pasan los avatares a `usosPorFormato`; el grafo NO, porque dibuja también las razones
huérfanas (colgadas de la raíz) y su cuenta tiene que ser la de sus aristas. Regla: **un conteo que se muestra al lado de
otra pantalla cuenta lo que esa pantalla dibuja**, no las filas que hay.

**Vive en:** `lib/angulos-data.ts` (`usosPorFormato`) · `app/api/onboarding/formatos/route.ts` · `app/onboarding/FormatosView.tsx` ·
`lib/angulos-formatos.ts` · `lib/cerebro-grafo.ts` · `lib/api-mako/areas/contenido.*` · `tests/angulos-sin-recomendacion.test.ts`

*23/10/2026 · chat «Offer» (cuenta claude1) · medido en prod con un SELECT; no se miró en el navegador.*

---

## La API de MaKo ya cierra pasos del onboarding: la decisión del Cerebro, y lo que la hace segura (23/10/2026)

**El pedido.** Martín, 23/10/2026: «Y si hay que hacer una revisión completa de la API, porque creo que faltan muchas
acciones posibles». La auditoría de ese día (P0-12 y P0-13) encontró que la API sólo LEÍA el onboarding: un negocio que
un chat de afuera dejó con perfil, productos y fase seguía con el arranque bloqueando la app, y un Copy Generator con
avatares, lead magnet y personalidad cargados seguía pendiente (y por eso el Video Generator no abría).

**Lo que estaba escrito, y por qué no lo prohibía.** La entrada del 16/10 de este documento dice: «La API de MaKo no
cambió, a propósito: el onboarding es la primera conversación de una persona y no tiene sentido que un agente la haga
por ella». La decisión del Cerebro (23/10/2026), textual: «va. El "a propósito" de hallazgos-onboarding cuida la PRIMERA
conversación de la persona (el chat de arranque), y cerrar o postergar un paso no la toca. Además, el 23/10 Martín pidió
que todo lo que se hace en pantalla esté en la API». **El porqué, en una línea:** lo que protegía aquella frase era la
conversación, no el estado; cerrar un paso cuyo dato YA existe no reemplaza ninguna pregunta que la persona tenía que
contestar.

**Las reglas que quedan** (código en `lib/onboarding-pasos-api.ts`, puro y con test; las lecturas en `lib/onboarding-hechos.ts`):
- **Un paso se cierra con el DATO VIVO, nunca con la palabra del modelo.** Cada paso se comprueba con el criterio que ya
  tiene su pantalla: «Tu negocio» = el perfil dice a qué se dedica (`negocio_que_hace`, lo que el arranque escribe
  siempre); «Lo que vendes» = al menos un producto; «El diagnóstico de fase» = guardado; «Verificar tu teléfono» = el
  GUARDADO es el verificado; «Conectar tus cuentas» = todas las que pide su capa.
- **«Tu plan de arranque» (capa Project Manager) no deja un dato propio**: es el cierre del modo 'plan' del chat, que lo
  marca junto con el negocio y la fase. Por la API se exigen esos dos. No se inventó un dato que no existe.
- **Los pasos que salieron del arranque** (archivero, entregable, avatares, persona, personalidad, angulos, gemini, retro)
  vuelven `sinDato` y no se cierran por la API. El `satisfies Record<PasoOnboarding, …>` obliga a decidir el próximo.
- **Postergar, sólo `PASOS_POSTERGABLES`**, y se rechaza si lo que el paso pide ya está resuelto: lo cierto es cerrarlo
  como hecho. Un paso ya cerrado (o ya postergado) es «ya está así» (`yaEstaba`), no otra escritura.
- **Nunca toca el chat de arranque**: no escribe `onboarding.arranque`, y el estado se escribe por la MISMA puerta que el
  wizard y el chat (`cerrarPasosOnboarding`). Cuando con ese paso quedan todos, el resumen que confirma la persona lo dice
  («el arranque termina y la persona entra directo a la app»). Confirmación por chat, sólo el admin.
- **Los pasos de una tab que la API marca son los de CONTEXTO** (`PASOS_TAB_POR_API`): Copy Generator entero (la matriz
  se comprueba con las celdas de un avatar que existe), las fotos y el acento del Video Generator, la guía de voz de
  Automations y el contexto de Carousels y Stories. Los ensayos y las conexiones los cierra la tab al comprobarlos; las
  muletillas tampoco («ninguna marcada también es una respuesta»: no hay dato que comprobar, y marcarlas desde afuera
  sería contestar por la persona; revisión del mismo día); los que la página deriva sola (Reels, Clientes, Curso, Ads Manager…) no se tocan.
- **Desmarcar va por `desmarcarPasoEnTodasLasTabs`** (el paso vive en la tab Y en el registro compartido), y en el Copy
  Generator corre antes `puentearPasosCopyGen`: si el puente de una sola vez todavía no corrió, la próxima carga volvía a
  marcar lo que se acaba de desmarcar.

**Trampas que aparecieron:**
- **`getVozCliente` no devuelve `acentoOrigen`.** Lo guarda `setAcentoCliente`, pero el getter lo tira: por ese camino no
  se puede saber si el acento lo eligió la persona o se sugirió por la zona. La API marca `vg_acento` con cualquier acento
  guardado, que es lo que hace la pantalla (también marca con 'sugerido-zona' si no se tocó el control).
- **«Teléfono verificado» tiene dos criterios.** El arranque, el wizard y ahora la API exigen que el teléfono guardado sea
  el verificado; `lib/onboarding-pendientes.ts` (el recordatorio de /general) mira sólo `.verificado`. No se tocó.
- **`MIN_FOTOS = 5` vivía adentro de `PersonaView`**: se mudó a `lib/persona-reglas.ts`, que leen la pantalla y la API.

**Lo que quedó SIN hacer:**
- Que MaKo por WhatsApp las ofrezca con un pedido dicho en imperativo: el clasificador lo toma como algo para anotar
  (ver docs/hallazgos-api-mako.md, misma fecha). Por la app y por HTTP llegan.
- No se corrió contra la base ni en el navegador: las reglas están probadas con tests (puros y de fuente).

**Vive en:** `lib/onboarding-pasos-api.ts` · `lib/onboarding-hechos.ts` · `lib/onboarding-state.ts` (`cerrarPasosOnboarding`,
con la capa como 4.º argumento) · `lib/persona-reglas.ts` · `lib/api-mako/areas/negocio.def.ts` y `negocio.run.ts`
(`cerrar_paso_onboarding`, `marcar_paso_onboarding_tab`) · `tests/api-negocio-onboarding.test.ts`

*23/10/2026 · chat «API de MaKo» (claude2), agente de la revisión de la API · leído en el código y probado con tests; no
se corrió contra la base.*

## «Que redefina mi avatar con los clientes ganados... no funciona al preguntar» (27/10/2026, claude5, MAU-02 de Mauricio)

**Dos causas, y la obvia era la segunda.** Lo obvio era «la IA arma mal el avatar». Lo primero que fallaba era el TURNO: la frase
de Mauricio caía en «consultar» y con eso sólo viajan lecturas, así que `generar_avatares` (una acción) nunca llegaba al modelo.
**La regla:** un pedido nuevo se prueba con el turno que corre (`clasificarIntencion` + `herramientasDelTurno`), con la frase como
la escribió la persona; ahora `PIDE_AVATAR` (lib/mako-intencion.ts) lo vuelve un pedido del área negocio. El avatar de un VIDEO
(AI Avatar) o el de un guion de anuncios no entra en esa regla.

**Trampa (27/10, claude4): «avatar» son dos cosas, y excluir las palabras del video no alcanza.** Con sólo la exclusión
(video, voz, guion, anuncio…), «creame un avatar en la oficina» y «hacé que mi avatar diga: hola» (AI Avatar) caían en el del
negocio y perdían `ver_avatares` (tests/ops-center-clasificador-app, generator_avatar). **La regla:** la regla del negocio pide
una señal de NEGOCIO (`AVATAR_DEL_NEGOCIO`: definir, clientes, ganados, compraron, cliente ideal, público…), y «diga/hable» cuenta
como video. Un «armame un avatar» suelto sigue su camino de antes.

**La segunda:** `generarAvatares` (lib/avatares.ts) nunca miraba a quién le vendió de verdad: el perfil, el panorama y la fase.
Ahora suma los leads GANADOS del CRM, agregados (lib/avatares-ganados.ts): cuántos, el ticket, el sexo, el ingreso estimado, lo
más contestado en el formulario por pregunta y por dónde entraron. Sin nombres, emails, teléfonos ni empresas (las preguntas de
contacto del formulario no viajan), con 3 ganados como mínimo, y el pedido va con `pii` (sólo IA que no entrena).

**Sin hacer:** «probado en el ws3» con datos de verdad: leer producción lo tiene negado el clasificador de permisos de esta
sesión. tests/avatares-ganados.test.ts lo prueba con datos armados.

## El WhatsApp pasó a ser lo primero, y adelantar una pregunta no es moverla (30/10/2026)

**El pedido.** Con el pago antes de entrar, «el WhatsApp del comprador se pide en el primer paso adentro de la app, con una sola
pregunta y sin formulario». **La decisión:** es la MISMA pregunta que iba al final, con su código y su «Ahora no». Llamar directo a
`setNumeroDuenoYSync`, que se propuso para ahorrar el código, suma al grupo un número sin probar: es lo que la auditoría del 14/10
cerró. El número queda en el contacto de los reportes apenas lo da; el grupo, recién con el código.

**Lo que se rompía en silencio al adelantarla, sin que ningún test del orden lo viera:**
- `e.negocio || 'tu negocio'`: todavía no hay negocio, y el grupo de WhatsApp nacía «MaKo <> tu negocio». Va vacío para que
  `verificarCodigoContacto` use el del workspace, y al decir el negocio `asegurarGrupoMaKo` le corrige el nombre.
- La entrada de MaKo (`ChatArranque`) salía sólo con la etapa `nombre`: con otra primera etapa no sale nunca, sin error.
- El contacto nacía sin nombre: se completa cuando lo dice.
- **Escribir el número en la caja del chat contestaba «Ahora no estoy esperando eso».** Al final de la charla casi no se veía; como
  primer mensaje, después de pagar, es lo primero que cualquiera hace. No salió de los tests: salió de mirar la pantalla en el banco y
  ver la caja abierta debajo de la tarjeta. Ahora vale igual que la tarjeta (`telefonoEscrito`). Sin lada, pide el país: un número
  local no se adivina, porque el código le llegaría a otra persona.

**El diagnóstico obvio era el equivocado: 58 rojos parecían una rotura y eran 51 datos de prueba viejos.** Casi todos los tests del
onboarding arman sus hechos con `conTelefono: true` y un estado sin teléfono, así que todos quedaban parados en la primera pregunta.
Pasaron a `conTelefono: false`, y sólo 7 fijaban de verdad el orden viejo. La corrida entera CON teléfono es `recorrer` en
tests/onboarding-historial.test.ts; el orden, tests/onboarding-whatsapp-primero.test.ts. **La regla:** un test que no es sobre el
teléfono arranca sin teléfono; si un paso nuevo va primero, ese test no tiene por qué contestarlo.

**Medido antes de escribir código, para no escribirlo (producción, sólo lectura, 31/10):** 17 negocios con onboarding, 1 sin empezar,
0 a mitad con respuestas y 0 terminados sin historial. Por eso NO se cubrieron dos casos que hoy no le pasan a nadie:
- Alguien a mitad con su charla de Offer vería la pregunta arriba y la charla debajo, porque Offer se dibuja entre `antes` y
  `despues`. Se arregla solo al contestar. Vive en `mensajesDeArranque`, en el retorno temprano del teléfono.
- `scripts/reconstruir-historial-onboarding.mts` pondría el teléfono arriba en quien lo contestó al final. Hoy no tiene a quién
  reconstruir. Hay que mirarlo antes de volver a correrlo.

**Quien lo dio al pagar no lo escribe de nuevo (31/10, acordado con Planes).** El checkout de /planes pide el WhatsApp, optativo, y el
alta lo deja en `cuenta.whatsapp_del_pago`. La pregunta del onboarding se queda: ese número sale de un formulario público y no está
probado, y sólo el código permite sumarlo al grupo. La tarjeta arranca con él, editable; lo manda un toque, nunca solo, porque si lo
escribió mal el código le llega a otra persona. **La trampa:** `splitTelefono` no devuelve «no sé» con un país desconocido: le pone el
de por defecto a todos los dígitos, y el número se ve correcto. Por eso `tarjetaConNumero` arranca vacía en ese caso.

**Sin hacer:** el texto de esa clave está en los dos lados para que las dos puntas suban en cualquier orden, y un test los compara
apenas exista `CLAVE_WHATSAPP_DEL_PAGO` en `lib/origen-cuenta.ts`. Después de subir, se reemplaza por el import en
`lib/onboarding-arranque-server.ts`. Visto sólo en el banco, con `ChatArranque` y las reglas reales y la ruta simulada (la entrada, la pregunta, el código y
«Ahora no»). Sin ver: el código llegando a un WhatsApp de verdad, el grupo con el nombre corregido y el número escrito en la caja pasando por la
ruta de verdad (`telefonoEscrito` tiene test; que la ruta lo use, sólo un test que lee el código). Eso se prueba con un alta real.
---

## ⚠️ `resumenOnboardingTabs()` recorre TODO el catálogo: una tab de super admin en `TAB_ONBOARDINGS` le habla a cada cliente (31/10/2026)

**El caso.** Construyendo Knowledge (el método de los cursos para toda la app) había que
cumplir la regla del producto —toda tab tiene onboarding, y su estado alimenta a MaKo— para
una pantalla que **sólo ve el super admin** (Classroom › Methodology, desde el pedido de
Martín del 25/10). La entrada en `lib/tab-onboarding-catalogo.ts` parecía gratis.

**Qué habría pasado.** `resumenOnboardingTabs()` (`lib/tab-onboarding-state.ts`) itera
`Object.keys(TAB_ONBOARDINGS)` **sin ningún filtro de capa, de rol ni de visibilidad**, y
devuelve «TABS SIN CONFIGURAR… - <key>: falta …» para toda la que no esté `done`. Eso entra
en `buildSystemPrompt` (`lib/mako-context.ts`) con `negocio`, o sea en **el prompt de todos
los negocios, en todos los turnos**. Una entrada para una pantalla que el dueño no puede
abrir queda pendiente **para siempre**, y MaKo le dice que lo primero es ir a configurarla.

**La regla.** Antes de sumar una tab al catálogo de onboarding, mirar **quién la ve**. Lo que
el catálogo modela es «lo que este negocio tiene que terminar de configurar»; una pantalla de
plataforma no es eso. Y si el estado igual le sirve a MaKo, va **el dato, no el flag**: en
Knowledge, el prompt lleva cuántas fichas tiene cada módulo (`estadoDeLosModulos()`,
`lib/knowledge.ts`), que es verdad para cualquiera que lo lea.

**Lo que queda abierto.** El catálogo no tiene forma de declarar «esta tab es de la
plataforma» (ni `soloSuperAdmin` ni `capas`, que sí existen en el nav). Si algún día una
pantalla de super admin necesita onboarding de verdad, el campo hay que agregarlo **y**
filtrarlo en `resumenOnboardingTabs`: hoy el único control es no estar en el catálogo. Vive
en `lib/tab-onboarding-catalogo.ts` y `lib/tab-onboarding-state.ts`.

## El primer ingreso: «¿Te sirven?» preguntaba una acción y la IA elegía el funnel (5/11/2026)

**Síntoma:** el CRM del onboarding decía «Estas son las etapas… ¿Te sirven?» sobre un tipo que elegía la IA entre los de su
canal, sin mirar cuánto invierte ni qué ya hace. La salida terminaba en «¿arrancamos por ahí?» sin botones (una pregunta que
nadie podía contestar con un toque) y prometía el grupo de WhatsApp a quien había salteado el teléfono.

**Causa:** el arranque no preguntaba cómo le llegan hoy los clientes, y la propuesta de CRM (`crmOffer`) no veía el presupuesto
ni el resultado de su funnel (están en el diagnóstico, que ya estaba guardado al llegar al CRM). El link del borrador del plan
vivía sólo en la tarjeta del «¡Listo!» y se perdía.

**Lo que quedó (T2 de docs/mako-iniciativa/plan.md):**
- `recomendarFunnel` (lib/funnel-recomendado.ts) decide el tipo con el canal, la entrada y el diagnóstico (`faseNegocio` en los
  hechos); la IA recibe UN candidato y sólo nombra sus etapas. Es la única traducción entre los catálogos de funnel: la escalera,
  Offer y el CRM la usan cuando les toque.
- La etapa `entrada` va sólo por llamada o por chat (con webinar, carrito o presencial el canal decide). Lo escrito se propone y
  se confirma con un toque, como el interés (`elegirOpcion`).
- ⚠️ **`opcionMasCercana` empata con palabras cortas**: «me escriben por Instagram» no elige nada porque «me» está en «Todavía no me
  llegan» y «escriben» en «Te escriben». No es un bug: con empate pregunta otra vez, que es lo correcto.
- La salida no pregunta nada y nombra el grupo sólo con `telefono === 'verificado'`. `planBorrador` queda en el estado.

**Vive en:** lib/funnel-recomendado.ts, lib/onboarding-arranque.ts, lib/onboarding-arranque-server.ts,
app/api/onboarding/arranque/route.ts, app/api/onboarding/plan-arranque/route.ts. Lo fija tests/onboarding-funnel-recomendado.test.ts.

