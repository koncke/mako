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
generador consulta. Sacarla también de Second Brain es otra decisión.

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

⚠️ **DECISIÓN PENDIENTE DE MARTÍN: «Ángulos».** Se quedó en Second Brain → Razones → Ángulos porque él no eligió
sacarla. Ningún generador lee sus recomendaciones (`elegirAngulo` elige de la biblioteca entera) y cada
«regenerar» paga IA. La nota está también en su fila de `DONDE_SE_EDITA`.

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

*16/10/2026 · chat «Onboarding» (claude3), medido contra el código, sin subagentes.*
