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

*2026-08-10 ~productos-x-funnels. El plan completo:
[productos-y-funnels-plan.md](productos-y-funnels-plan.md)*

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
