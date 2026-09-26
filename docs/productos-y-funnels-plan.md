# Múltiples productos, múltiples funnels — plan

> ⚠️ **Este documento lleva el ORDEN DE TRABAJO. El MODELO DE DATOS vive en
> [modelo-oferta-producto-funnel.md](modelo-oferta-producto-funnel.md)** y ese es el que
> manda: el dueño contestó las 3 preguntas del final el 2026-08-10 y su respuesta invalidó
> la sección 2 y la fase F3 de acá. No se copian los esquemas: se linkean.

## Estado al 2026-09-26 — leer esto primero

**Hecho:** F0 (commit `97f98ba`) · **F1 y F2 están EN EL ÁRBOL, sin commitear**. El producto se
ve igual que ayer: lo único nuevo que se ve es la carga de la oferta, y va adentro del
onboarding (paso «productos») y del área Oferta de `/second-brain`. Nada nuevo en el nav.

**Las tres migraciones están escritas y NO aplicadas.** Se renumeraron porque el repo ya iba por
`0168`; el orden de aplicación es el que manda el modelo. **Aplicar en este orden:**

| # | Archivo | Es la del modelo | Qué crea |
|---|---|---|---|
| 1 | `supabase/migrations/0169_ofertas.sql` | 0125 | `ofertas`, `oferta_productos`, `lead_magnets`, `leads.oferta_id` |
| 2 | `supabase/migrations/0170_funnels.sql` | 0126 | `funnels` (copia `funnel_config`, que queda deprecada) + `nutricion_secuencias.funnel_id` |
| 3 | `supabase/migrations/0171_funnel_ofertas.sql` | 0127 | `funnel_ofertas` + la vista `v_funnel_productos` |

⛔ **Las tres van ANTES o JUNTO con su deploy, nunca después.** El código ya las lee: el rename
sacó `funnel_config` de todo el repo en el mismo commit. Es el orden inverso al de la 0167/0168,
que sacaban algo que ya nadie usaba. Sin la 0170, el CRM pinta las columnas genéricas; sin la
0169, la vista de ofertas muestra error en rojo.

**Falta F3** (`lead_participaciones`: el lead en dos funnels a la vez, y el desplegable de oferta
al cerrar en el CRM) y, antes que eso, su prerrequisito: **un solo writer de `leads`**. Hoy hay
**47 escrituras en 17 archivos** (medidas el 26/09). El detalle, en
[hallazgos-crm.md](hallazgos-crm.md) → «Cosecha de F1+F2».

---

De dónde salió este plan (2026-08-10, cuando solo estaba F0). Las 3 decisiones abiertas están
contestadas — ver §5. Salió de una corrida de 15 agentes (`~productos-x-funnels`) más una
segunda de 11 (`~modelo-oferta-producto-funnel`) con las respuestas del dueño como premisa.
Los hallazgos que la sostienen están en [hallazgos-crm.md](hallazgos-crm.md) → «El funnel:
de dónde salen las etapas» y en [hallazgos-onboarding.md](hallazgos-onboarding.md) → «El
estado del wizard».

**Las 3 respuestas del dueño, textuales, que son la premisa de todo lo demás:**
1. «Un producto puede tener varios funnels, y un funnel puede tener varios productos. Muchas
   veces los funnels son diferentes en el TOFU pero luego en el BOFU son lo mismo, terminan
   todos con llamada de ventas por ejemplo, y en el TOFU es orgánico, otro por ads, etc.»
2. «Un lead podría aparecer en 2 funnels a la vez, ya que no terminó de cerrar en un funnel y
   meses después aparece en otro… Pero eso no significa duplicar al lead.»
3. «No, oferta no debe desaparecer. Una oferta es mucho más que un producto… Contiene otras
   cosas que para un dueño de negocio es importante para poder vender.»

Contexto: #374 (catálogo de productos), #363 (venta recurrente, cerrado), #210 (assets por
producto), #186 (escalera de valor). Decisiones ya cerradas por el dueño que **no se
revuelven**: elegir producto al cerrar es obligatorio (con «Otro/personalizado»), el
catálogo vive en el ONBOARDING y no en Configuraciones, el alta es de a una pregunta por
pantalla, y la IA COMPLETA con lo ya cargado en vez de re-preguntar.

---

## 1. Dónde estamos de verdad

*(Estado del relevamiento del 2026-08-10, ANTES de F0. Se deja como estaba porque es el
diagnóstico que originó el plan; lo tachado se arregló en el commit `97f98ba`.)*

- ~~**El catálogo `productos` está construido y no lo usa nadie.**~~ Tabla
  (`0117_productos.sql:16-31`), CRUD, `TENANT_TABLES` y RLS existían, pero
  `seedProductosDesdeOferta()` no tenía **un solo call-site** y `upsertProducto` no escribía
  `orden`. **Arreglado en F0.** Lo que SIGUE sin existir: `leads.producto_id` (`0117:34`) no
  la lee ni la escribe una sola línea de TypeScript — la mitad declarada de #374, «el deal
  hereda el pricing del producto», todavía no existe. Eso es F3.
- ~~**La puerta de entrada al catálogo está rota hoy.**~~ El paso `'productos'` estaba en
  `PasoOnboarding` y en el orden de la capa `completo`, la pantalla se pintaba, pero la clave
  no existía en `OnboardingState.steps` ni en el union `Body.step`:
  `s.steps['productos'].done = true` era un TypeError sobre `undefined` → 500, y como el
  cliente no miraba `ok`, avanzaba igual y al volver aterrizaba siempre ahí. **Arreglado en
  F0** y verificado contra ws3: paso válido → 200 y persiste; paso inventado → 400.
- **«Múltiples funnels» no existe en ninguna capa.** `grep funnel_id` en todo el repo: cero.
  La base lo prohíbe (`0054_workspaces.sql:95`) y hay tres escritores que upsertean con
  `onConflict:'workspace_id'`.
- **Lo que sí está bien:** el MODELO ya es multi-funnel-ready. `generateFunnel`,
  `salidasDeEtapa`, `mergeFunnelData`, `sanearPipeline` y los templates reciben el pipeline
  **por parámetro** y no tocan Supabase. Lo acoplado a «hay uno» son las funciones de acceso
  de `lib/leads.ts`, no el modelo.

---

## 2. La decisión de modelo

**Esta sección quedó reemplazada por [modelo-oferta-producto-funnel.md](modelo-oferta-producto-funnel.md).**
Lo que decía —`funnels.producto_id` como FK 1:N, `leads.funnel_id` como una columna, y la
oferta deprecada a favor del catálogo— lo invalidaron las tres respuestas del dueño. No se
reescribe acá: se linkea, que es la regla de la casa.

El resumen, para no tener que abrir el otro documento solo para saber de qué se habla:

- **Cuatro entidades y dos puentes.** `productos` (lo que se entrega y se factura, ya existe),
  `ofertas` (cómo se presenta para que se compre: promesa, garantía, precio de ESTA versión,
  bonos, urgencia, lead magnet), `funnels` (por dónde entra —TOFU— y dónde cierra —BOFU—) y
  `lead_participaciones` (un lead × un funnel × un INTENTO). Los puentes son
  `oferta_productos` y `funnel_ofertas`, los dos N:M.
- **El criterio que las separa:** un cambio en el producto cambia una FACTURA; uno en la
  oferta cambia un ANUNCIO; uno en el funnel cambia un RECORRIDO; uno en la participación
  cambia UN CASO.
- **producto ↔ funnel es N:M y se DERIVA** (`funnel_ofertas ⋈ oferta_productos`), no se
  guarda en ningún lado. La arista va a la OFERTA porque «TOFU distinto, BOFU compartido» son
  dos funnels vendiendo lo mismo con otra promesa y otro bono: eso es otra oferta del mismo
  producto.
- **El grupo `oferta` del brief NO se apaga y NO se copia.** La fila existe en `ofertas` con
  los 5 campos en NULL y `desde_brief = true`; el valor sigue viviendo en el blob de
  `app_settings` y lo resuelve `ofertaPrincipal()`. Cero duplicación, cero backfill de datos.
  El único lector que cambia es `perfilNegocioTexto()` — que hoy alimenta ~20 features contra
  las 2 del catálogo de productos, y por eso apagarlo hubiera sido carísimo.
- **El lead en dos funnels sin duplicarse:** `lead_participaciones` es la fuente de verdad del
  recorrido, y las ~35 columnas homónimas de `leads` pasan a ser su ESPEJO de la participación
  activa, escrito por UN solo writer. Ninguna columna se dropea nunca, así que ningún lector
  de hoy se rompe. Funciona porque **la etapa no está guardada**: `deriveStageKey` la deriva
  de 8 columnas que son todas del intento.
- **El BOFU compartido NO es una entidad.** Tres funciones razonan por el índice de la etapa
  dentro del pipeline completo (`generateFunnel`, `funnelReqInfo`, `salidasDeEtapa`), así que
  un tramo referenciado obliga a meter un offset en las tres. El repo ya lo resolvió sin
  entidad: la plantilla `presencial` comparte el cierre **reusando la clave canónica**. Lo que
  el dueño pide de verdad —que la nutrición y las métricas de cierre no se le tripliquen— sale
  con `nutricion_secuencias.funnel_id` NULLABLE = sirve a todos los funnels.

Lo que SÍ sobrevive de la versión original de esta sección, y sigue vigente:

- **Las stage keys no se prefijan.** El ámbito lo da `lead_participaciones.funnel_id`, nunca
  el nombre de la key: prefijar invalidaría todos los `pipeline_stage` guardados, `lead_audit`
  y `etapa_vista`. Y es justo lo que permite el «BOFU compartido» por reuso de clave.
- **El precio es snapshot, no JOIN** — ahora el snapshot vive en `lead_participaciones`.
- **La capa de IA en un solo lugar** (`lib/oferta-contrato.ts` sin `server-only` +
  `lib/oferta-contexto.ts` con él), con la unidad de contexto corregida: el par **(oferta,
  funnel)**, no (producto, funnel).

---

## 3. Las fases

**Orden obligatorio: F0 → F1 → F2 → F3.** Y una regla dura que sale del modelo nuevo: el
**release-gate** (§3 de [modelo-oferta-producto-funnel.md](modelo-oferta-producto-funnel.md))
tiene que estar entero **en el mismo release** que permita a un lead tener DOS participaciones
abiertas. Las cinco cosas de esa lista producen datos FALSOS, no vacíos: ninguna es diferible.
F5 y F6, en cualquier momento después de F3.

⚠️ **Las migraciones se renumeraron.** El modelo nuevo mete `ofertas` primero, así que la
tabla `funnels` pasó de 0125 a **0126**. El mapa completo está en el otro documento; acá los
títulos ya llevan el número corregido.

### F0 — DESTRABAR · sin migración · ✅ HECHA (commit `97f98ba`)

El paso de productos no persistía, el reset arrastraba catálogo viejo y «Completar como
Mauricio» entregaba un negocio sin catálogo. Sin F0, todo lo demás se probaba contra un
onboarding roto.

- `lib/capas.ts:24` — `PASOS_ONBOARDING as const` (fuente única) y `PasoOnboarding = typeof
  PASOS_ONBOARDING[number]`.
- `lib/onboarding-state.ts:56-70,85-99` — `steps: Record<PasoOnboarding, {done:boolean}>` con
  `Object.fromEntries`. **No** agregar `'productos'` a mano a las cuatro listas: eso repite el
  antipatrón. `getEstadoOnboarding` ya deep-mergea sobre el esqueleto, así que los estados ya
  persistidos se arreglan solos.
- `app/api/onboarding/route.ts:167` — `Body.step?: PasoOnboarding` validado con
  `esPasoOnboarding()` en positivo.
- `app/onboarding/OnboardingWizard.tsx:55` — importar el union; `:388-389` — mirar `j.ok`.
- `lib/productos.ts:57-67` — escribir `orden` (hoy el `.order('orden')` de `:47` es inerte).
- `app/api/onboarding/productos/route.ts:61-65` — **merge campo a campo**, y pasarle a
  `sugerirProductos` el producto **entero**, no nombre y precio (`lib/productos-ia.ts:92-94`).
- `lib/reset-workspace.ts:62`, `lib/clonar-config.ts:48-53`, `lib/datos-mau.ts:142-290` — sumar `'productos'`.
- `lib/prompt-registry.ts` — registrar `productos.system`/`productos.user`;
  `lib/model-catalogo.ts` — feature `productos` con `def` de proveedor **gratis**.
- Llamar por fin a `seedProductosDesdeOferta()` desde el GET de la ruta de productos.
- **`app/api/email/generar/route.ts:18,23`** — sacar la oferta y el Calendly de Mauricio del
  system prompt. Es una fuga de contenido cross-tenant **viva hoy**.

**Terminada cuando:** un cliente completa productos, cierra el navegador, vuelve, y aterriza
en el paso SIGUIENTE. El reset del ws3 deja el catálogo vacío. `/email` no menciona a Mauricio.

✅ **Verificado contra la app (ws3, server local sobre la base de prod):** `step:'productos'`
→ 200 y persiste (antes 500 mudo); paso inventado → 400 con mensaje. Y dos corridas reales de
«sugerir»: la primera completó `monto_usd` de null a 5000 sin tocar promesa/incluye/garantía;
la segunda, sobre el producto ya completo, no cambió **un solo campo** ni creó duplicados.
554/554 tests en verde.

Lo que quedó SIN hacer de F0, a propósito, y dónde vive: los retoques de UI de
`app/onboarding/ProductosView.tsx` (copy a español neutro, emojis a `<Icon>`, borrado con
`Confirm`, toggle `activo`). No bloquean nada y se hacen junto con la pantalla de ofertas.

### F1 — La tabla `funnels`, sin cambio de comportamiento · migración 0126 → **0170** · ✅ ESCRITA (26/09, SIN APLICAR)

> ⚠️ **Renumerada.** El repo ya iba por `0168`, así que las tres migraciones del modelo se
> escribieron como **0169 (ofertas) → 0170 (funnels) → 0171 (funnel_ofertas)**, manteniendo el
> orden de aplicación que manda el otro documento. Cada `.sql` dice a qué número del doc
> corresponde.
>
> **Lo que quedó hecho en el árbol (sin commitear y sin aplicar la migración):** `lib/funnels.ts`
> (`getFunnelDefault`, `getFunnelDe`, `getFunnelDeLead`, `saveFunnelDe`, `saveFunnelDefault`,
> `crearFunnel`, `listarFunnels`, `umbralesDelFunnelDefault`), el mapeo puro en
> `lib/funnel-fila.ts`, el rename con sus **33** call-sites decididos uno por uno, los seis
> archivos del checklist + `scripts/reparar-senal-funnel.ts` y `scripts/reset-chatbot-leila.ts`
> (que el checklist no listaba), `funnels` y las cuatro tablas de F2 en `TENANT_TABLES`, y
> `tests/funnel-declarado.test.ts`.
>
> **Lo que NO se hizo:** F2 en TypeScript (`ofertaPrincipal()`, `seedOfertaDesdeBrief()`, la UI
> de ofertas y el selector de funnel). De F2 solo están escritas las migraciones.
>
> ⛔ **La 0170 se aplica ANTES o JUNTO con su deploy**, no después: el código ya no lee
> `funnel_config`. Es el orden inverso al de la 0167/0168.


Es el andamio de todo lo demás. La 0126 copia `funnel_config` → `funnels` de forma no
destructiva (una fila `'Funnel principal'` por workspace, `declarado=true` si tenía fila,
`'{}'`/`false` si no) y **`funnel_config` no se toca**: queda como respaldo.

Dos cambios respecto de la versión original de esta fase: la tabla **ya no lleva
`producto_id`** (el vínculo va a `funnel_ofertas`, en F2), y **sí lleva `canal`** — que es la
respuesta 1 del dueño: nullable = hereda el del negocio. Corolario que conviene tener claro:
`TEMPLATE_POR_CANAL` deja de significar «qué funnel le toca a este cliente» y pasa a significar
«con qué tramo de cierre se **siembra** un funnel nuevo».

Checklist cerrado — los 5 lugares que referencian `funnel_config` por string, invisibles al
compilador:

| Archivo | Después |
|---|---|
| `lib/leads.ts:1472-1530` | `lib/funnels.ts`: `getFunnelDefault()`, `getFunnelDe(id)`, `getFunnelDeLead(lead)`, `saveFunnelDe(id,…)`, `crearFunnel()`. **Nunca `maybeSingle()`**: `.order().limit(1)` explícito, y el `catch` loguea |
| `lib/crm-auto.ts:51` | `umbrales` del funnel del lead |
| `lib/clonar-config.ts:49,95-109` | insert por funnel, borrando `entradas`/`evento` **y `producto_id`** (apuntan al catálogo del dueño) |
| `lib/datos-mau.ts:174,503-505` | ámbito `funnels` no-singleton |
| `lib/plan-senales.ts:98` | `hayFilasWs('funnels')` |
| `lib/reset-workspace.ts:62` | `'funnels'` **+ recrear el default después de vaciar** (guard en positivo: un ws SIEMPRE tiene exactamente un funnel default, sin declarar) |

**Rename, no alias:** `getFunnel()` → `getFunnelDefault()`, `getPipelineStages()` →
`getPipelineStagesDefault()`. Dejar el nombre sin argumentos es dejar una función que
**miente** cuando hay N funnels — el bug que este repo ya pagó con `wsDePrueba()`. El rename
obliga al compilador a mostrar los ~31 call-sites una vez, y cada uno decide explícitamente si
sigue con el default (con comentario) o pasa a `getFunnelDeLead`.

`funnels` va a `TENANT_TABLES` desde el día uno: con N filas, olvidarse el `.eq` ya no da «no
encuentra», da **los funnels de otro cliente**.

**Terminada cuando:** cada workspace tiene exactamente un funnel, la pantalla se ve
**idéntica** a hoy, `npm test` verde, y `grep funnel_config` solo devuelve la migración.

### F2 — Las OFERTAS, y N funnels por oferta · migraciones 0169 + 0171 · ✅ HECHA (26/09, SIN APLICAR)

> ⚠️ **Renumeradas**, igual que en F1: la 0125 del doc es **0169** y la 0127 es **0171**. El
> orden de APLICACIÓN que manda el modelo no cambia: **0169 (ofertas) → 0170 (funnels) →
> 0171 (funnel_ofertas)**. Las tres están escritas y **sin aplicar**.
>
> **Lo que quedó hecho en el árbol:** `lib/oferta-modelo.ts` (PURO, sin `server-only`: ahí viven
> `resolverOfertaPrincipal` y `urgenciaVigente`, las dos reglas que hay que poder testear),
> `lib/ofertas.ts` (CRUD scopeado de `ofertas`, `oferta_productos`, `funnel_ofertas` y
> `lead_magnets`, más `ofertaPrincipal()` y `seedOfertaDesdeBrief()`), `lib/ofertas-ia.ts`
> (`sugerirOferta`, prompt editable + entrada en el catálogo de modelos con default GRATIS),
> `app/api/onboarding/ofertas/route.ts`, `app/onboarding/OfertasView.tsx`, el cambio en
> `perfilNegocioTexto()`, el selector de funnel de `/funnel` (`?f=`, **que sólo se pinta con más
> de uno**), las cuatro tablas nuevas en `TABLAS_RESET` y `tests/oferta-brief.test.ts`.

> ⚠️ **CORRECCIÓN: lo que dice abajo sobre la PANTALLA está invalidado por el dueño.** No hay
> pantalla propia ni entrada en `app/_components/nav.ts`: la oferta se carga **dentro del
> ONBOARDING**, en el mismo paso `productos` y reusando el molde de `ProductosView`, y se ve
> también como sub-vista «La oferta» del área `oferta` de `/second-brain`. Es la misma regla que
> ya estaba en la intro de este documento («el catálogo vive en el ONBOARDING y no en
> Configuraciones») y que esta sección no había recogido.

> **Lo que NO se hizo, a propósito:** `ofertas` en `lib/clonar-config.ts` y `lib/datos-mau.ts`
> (sus dos índices únicos parciales hacen que un insert ciego choque con 23505: hay que clonar
> sobre la fila que el destino ya tiene, como se resolvió con `funnels`), los lectores de
> `lead_magnets` (siguen en `app_settings['mako.entregable']`; el dato y sus ~14 lectores se
> mudan juntos o no se mudan) y `leads.oferta_id`, que es F3.


⚠️ **La 0125 va ANTES que la 0126 de F1** (crea `ofertas`, `oferta_productos` y `lead_magnets`,
y no depende de nada). El orden de trabajo sigue siendo F1 → F2 porque `funnel_ofertas` (0127)
necesita las dos tablas; el orden de APLICACIÓN es estrictamente 0125 → 0126 → 0127.

El esquema entero está en
[modelo-oferta-producto-funnel.md](modelo-oferta-producto-funnel.md) §2. Lo que cambia
respecto de la versión original de esta fase:

- El unique `(workspace_id, lower(btrim(nombre)))` se aplica a **`ofertas`**, no a `productos`
  — en `productos` requiere saneo previo de colisiones y no es prerrequisito de nada.
- La vista de carriles es **oferta → funnels**, no producto → funnels. Molde:
  `MatrizView.tsx:3-23,270-278`. La tabla producto×funnel sigue descartada por escrito ahí
  mismo: obliga a que todos tengan la misma cantidad y rellena con «—».
- Pantalla propia con `Pagina` + `PageHeader` + `Section` y entrada en `app/_components/nav.ts`. Lista con
  filete, no pila de tarjetas, y **no `.mk-fila`** (esa lleva la marca dorada de «acá
  intervino MaKo»; un catálogo comercial no lo es).
- Wizard «Agregar un funnel» con `WizardShell` usando **`pasos`+`pasoActual`** (el MAPA), no
  `total`/`idx`: tiene ramas, y `total`/`idx` es el antipatrón que el propio shell documenta
  (`WizardShell.tsx:26-42`). Tres preguntas cerradas: oferta → canal (siembra con
  `templateDeCanal`) → nombre prellenado.
- `urgencia` es un **chip cerrado** (fecha / cupos / capacidad / inicio) + dato + razón, no un
  textarea: así el sistema puede verificar solo cuándo venció y apagar el ángulo en código.
  `bonos` es jsonb para que MaKo proponga tres desde lo ya cargado y el dueño tilde.

**Terminada cuando:** se cargan 3 ofertas sobre 2 productos, una tiene 2 funnels editables por
separado, y con **un solo** funnel la pantalla se ve exactamente como hoy (el selector ni se
pinta).

### F3 — El lead y sus PARTICIPACIONES · migraciones 0128–0129

> ⚠️ **Esta fase quedó reemplazada por entero por la §3 de
> [modelo-oferta-producto-funnel.md](modelo-oferta-producto-funnel.md).** `leads.funnel_id`
> como columna única **no alcanza**: el dueño contestó que un lead puede estar en dos funnels
> a la vez sin duplicarse. Lo que sigue abajo es lo único que sobrevivió intacto — el paso
> `producto` del wizard Ganado y sus tres trampas.

El mecanismo, en tres líneas: `lead_participaciones` es la fuente de verdad del recorrido, las
~35 columnas homónimas de `leads` pasan a ser su **espejo de la participación activa**, y el
espejo lo escribe **un solo writer** (`escribirParticipacion` en `lib/participaciones.ts`).
Ninguna columna se dropea nunca, así que ningún lector de hoy se rompe.

**El paso 0, que no se puede saltear y va ANTES de la 0128:** hoy hay ≥32 escrituras a `leads`
en 15 archivos. Se colapsan en el choke point (`lib/participaciones-modelo.ts` sin
`server-only` con `COLUMNAS_ESPEJO`, `lib/participaciones.ts` con `server-only`, y
`lib/participaciones-lectura.ts`). Con una sola participación por lead eso es refactor puro,
verificable y reversible. Sin él, el espejo se desincroniza por el camino que nadie migró y el
síntoma aparece días después en otra pantalla — el mecanismo exacto del contrato del `detalle`.

- **El paso `producto` del wizard Ganado** — 12 puntos en 7 archivos. `StepId += 'producto'`
  (`lib/stage-requirements.ts:20-26`), push dentro del bloque `if (esVenta)` (`:226-242`), en
  `ORDEN` (`:268-274`) **antes** de `ventaTipo`/`monto` porque el producto define el pricing, y
  en `WIZARD_STEP_IDS` (`:301-307`). Server: `StageMoveData.productoId`, `valoresDeRequisitos`.
  Cliente: `PasoId`, `PASO_DE_STEP`, estado, push, `respondido`, render, resumen, payload.
  - ⚠️ **Condición de faltante propia (`productoId == null`)**, nunca colgada de `'monto'`:
    `stepsForStage` no pide `'monto'` cuando ya hay uno (`:232`) y el bloque entero se omite del
    payload (`StageMoveDialog.tsx:527-532`) — un deal viejo con monto nunca podría recibir
    producto. Es el bug que hoy deja `venta_tipo` inasignable.
  - ⚠️ **Se pide solo al ENTRAR** a la etapa (patrón de `'motivo'`, `:175`) o el worklist
    reclama producto sobre cientos de cierres viejos.
  - ⚠️ **Cablear los 4 constructores de `MoveLeadInfo`** (`StageMoveDialog.tsx:100-102` ·
    `LeadDetailBody.tsx:94-119` · `LeadSheet.tsx:114-129` · `GeneratedInsightCard.tsx:75-82`):
    `ventaTipo`/`suscripcionMeses` están declarados «para prefill» y **ninguno de los cuatro los
    setea**.
  - Persistir con `saveLeadMeta` (que **lanza**), no con el update aparte + `console.error` que
    devuelve `ok:true` aunque falle (`app/crm/actions.ts:463-474`).
- `producto_id` al tipo `Lead`, `LISTA_COLS`, `COLS_FILTRO`, `CrmLead`, `LeadDoc`. Render en el
  bloque «Pagos» de `DealDetailsCard.tsx:405-429`.
- Board: píldoras de funnel con `flex-wrap` (nunca scroll lateral), filtro **server-side**.
  La ficha muestra las participaciones con un selector de intento.

**Terminada cuando:** cerrás un deal, elegís la oferta, el tipo/monto/plazo vienen sembrados, y
el test de aceptación pasa: con una sola participación por lead, `getResumenComercialMaduras()`,
`getCohortesMensuales()` y `getFunnelEtapas()` devuelven objetos **idénticos** a los de hoy. Si
algo cambia, está mal el espejo, no el modelo.

### F4 — Los consumidores dejan de mentir · migración 0130 · parte del release-gate

**Regla dura: `nutricion_secuencias.funnel_id` tiene que estar en el MISMO release en que un
cliente real pueda crear su segundo funnel.** Es el único riesgo del proyecto que sale de la
pantalla y le llega a un lead: `leadsDeCohorte('etapa_actual')` trae todos los leads abiertos
del ws y filtra en memoria por `pipelineStageOf` (`lib/nutricion.ts:310-313`). Dos funnels con
`'noshow_r1'` se cruzan **mensajes reales de WhatsApp y email**, sin error y sin log.

⚠️ **`nutricion_secuencias.funnel_id` va NULLABLE, y el NULL significa «sirve a todos los
funnels».** Es la forma de que el «BOFU compartido» del dueño no obligue a triplicar cada
secuencia de cierre: la de No-Show se escribe una vez y vale para el funnel orgánico y el de
ads. Una secuencia con `funnel_id` puesto es la excepción, no la regla.

0130: `funnel_id` en `nutricion_secuencias`, `whatsapp_template_drafts`,
`evolution_stage_labels`, `landing_analyses`/`landing_drafts`, `script_analyses`,
`closing_analyses`, `setting_audios`. Backfill al default. `nutricion_secuencias.clave` **no**
es unique global (la 0054 ya la pasó a `(workspace_id, clave)`), así que sumar `funnel_id` es
un **afloje** y ninguna fila existente lo viola: **no hace falta prefijar claves**.

Archivos: `lib/nutricion.ts:285-313` · `lib/secuencias-huecos.ts:27-79` ·
`lib/crm-auto-plan.ts:69-138` (hoy hardcodea `'lead'`, `'nutri'`, `'manual'`, `'reactivacion'`
y falla en silencio con un funnel de etapas propias) · `lib/encuentro-ws.ts:36-44` ·
`lib/mako-doer-acciones.ts:120,484` · `lib/leads.ts:1708`.

**Terminada cuando:** un test fija que **con un solo funnel el conjunto enrolado por
`leadsDeCohorte` es idéntico al de hoy**, y con dos funnels ningún lead del A entra en una
secuencia del B.

### F5 — El contrato de la IA · sin migración

`lib/oferta-contrato.ts` + `lib/oferta-contexto.ts` (con tests, porque el contrato va sin
`server-only`), y después los 12 consumidores de a uno: `resumenFunnel()` se borra
(`mako-context.ts:51-67`) junto con el rótulo «fuente de verdad» en singular (`:114`);
`buildLandingBrief`, `briefNegocio` y `buildCampaignBrief` reciben el foco (se colapsan las
tres copias del mismo bloque); `setting-simulador.ts:133-147` y `nutricion-generator.ts:237-269`
resuelven por lead/secuencia; `closing.ts` y `ads-analyst.ts` empiezan a ver qué se vendía;
`ver_funnel` (`mako-tools.ts:215-223`) recibe `funnelId` opcional.

⚠️ **El texto en el prompt no alcanza.** La clienta que prospecta en frío grabó un audio que
decía «vi que dejaste tus datos en el anuncio» **aunque `resumenFunnel` ya iba en el prompt**:
perdió contra un bullet imperativo quince líneas más abajo. `ofertaTexto` es para que el modelo
acierte; **el precio, el id y la URL los pone el código**.

### F6 — Reportes por oferta y por funnel · dentro de la 0130

⚠️ **Lo que decía esta fase estaba MAL y hay que no hacerlo:** meter `producto_id`/`funnel_id`
en el GROUP BY de `v_cohortes_semanales`/`v_cohortes_mensuales` rompe el shape de las vistas
(`42P16` en el `CREATE OR REPLACE`) y hace que `cohortes_maduras_count: cohortes.length`
(`lib/queries.ts:458`) pase a contar semana × funnel **sin ningún error**.

El corte va en **vistas NUEVAS** (`v_cohortes_semanales_funnel`) que **no se suman** con las de
siempre; las de siempre cambian de fuente a `lead_participaciones` conservando sus 11 columnas
exactas. Más `getMrrActivo` (`lib/queries.ts:749-771`), que hoy asume una suscripción por lead
y con dos participaciones haría desaparecer el MRR de la venta anterior, y
`getFunnelMadurasLeads` (`:524-560`), donde sí habría doble conteo real de ingreso.

⚠️ Y lo que **no se puede** cortar por funnel, dicho ahora: impresiones, clics y formularios
(`getFunnelEtapas`, `lib/queries.ts:1182-1290`) salen de `marketing_metrics_daily`, que no
tiene dimensión de funnel ni de producto. Filtrar solo la salida da un **porcentaje falso**, no
un dato faltante. Lo mismo el CAC por funnel (`:664-693`): el spend de Meta no tiene atribución
a funnel en ninguna tabla. La pantalla lo **dice** en tinta normal en vez de mostrar un número
inventado o rotularlo «en construcción».

Es lo que vuelve útil tener N productos: poder decir cuál convierte. No bloquea nada.

---

## 4. Lo que se rompe si no lo tocamos

**Bloqueantes de esquema/acceso**

1. `funnel_config_ws_uk` prohíbe el 2º funnel — insert = `23505`. `0054_workspaces.sql:95`
2. `getFunnel()` usa `.maybeSingle()`: con N filas devuelve `PGRST116` y el `catch` de
   `lib/leads.ts:1497` lo convierte en `DEFAULT_PIPELINE` **sin un solo log**. Todo el CRM pasa
   a mostrar el pipeline genérico y nadie se entera. La falla más cara, y `getFunnel` no tiene
   ningún test.
3. Tres escritores con `onConflict:'workspace_id'`: `lib/leads.ts:1526-1527` ·
   `lib/clonar-config.ts:108-109` · `lib/datos-mau.ts:503-505`.
4. `funnel_config` exceptuada de `TENANT_TABLES` (`lib/workspace.ts:57`): con N filas, olvidarse
   el `.eq` da los funnels de **otro cliente**.
5. No hay dónde guardar a qué funnel pertenece un lead.

**Graves y silenciosos**

6. **Nutrición cruzada** (`lib/nutricion.ts:310-313`) → mensajes reales al lead equivocado. El
   único que sale de la pantalla.
7. **CRM automático funnel-ciego** (`lib/crm-auto-plan.ts:69-138`): no dispara T1..T6 en un
   funnel con etapas propias, sin error. El cliente concluye «el CRM automático no anda».
8. **El Kanban miente**: `app/crm/crm-map.ts:51-57` descarta el override ajeno y cae a la
   derivada; `stageMetaOpt` pinta prolijamente la etiqueta del otro funnel.
9. **`encuentroGrabable()` es workspace-wide** (`lib/encuentro-ws.ts:36-44`): el gate que ya
   produjo 20 No-Shows falsos por semana. Con un producto por llamada y otro presencial, siempre
   está mal para uno.
10. **El editor autoguarda cada 500 ms sin id de funnel** y está embebido en tres pantallas más
    (`app/funnel/page.tsx:25-29` · `app/onboarding/page.tsx:35-36` · `app/second-brain/page.tsx:43-44`).
11. **El paso `productos` deja al cliente varado** (`lib/onboarding-state.ts:56-70,85-99`).
12. **`/email` manda copy del negocio de Mauricio a todos los workspaces**
    (`app/api/email/generar/route.ts:18,23`). Vivo hoy, sin necesidad de multi-producto.

---

## 5. Las 3 preguntas — CONTESTADAS por el dueño (2026-08-10)

**1. ¿El canal de venta baja del negocio al funnel?** → **SÍ** (recomendación confirmada).
Columna `canal` en `funnels`, nullable = hereda el del negocio. La respuesta del dueño la
enriqueció: el funnel tiene **dos mitades**, y el canal es la de abajo. El TOFU (`data.entradas`)
es lo que DIFERENCIA dos funnels; el BOFU (`canal`) suele ser COMPARTIDO — «terminan todos con
llamada de ventas». Reescribe `ENCUENTRO_POR_CANAL`, `TEMPLATE_POR_CANAL` y `lib/encuentro-ws.ts`
en el release-gate.

**2. ¿Un lead puede correr DOS funnels a la vez?** → **SÍ. Mi recomendación era NO y estaba
mal.** Textual: «no terminó de cerrar en un funnel y meses después aparece en otro… pero eso no
significa duplicar al lead». Lo que la recomendación vieja tenía bien es el diagnóstico del
costo (los dos slots de reunión de `leads`, `lib/funnel-etapas.ts:52-68`); lo que tenía mal es
concluir que por eso no se hace. La respuesta es `lead_participaciones` — ver §3 del
[modelo](modelo-oferta-producto-funnel.md).

Y de paso destraba un bug **vivo hoy**: `upsertLeadFromCalendly` (`lib/leads.ts:943-1016`)
escribe `fecha_agenda`/`fecha_junta_1` sobre un lead existente sin tocar `estado_lead`, y
`deriveStageKey` hace short-circuit por `estado_lead`. Un lead 'perdido' que reagenda seis meses
después queda en la columna Perdido con una R1 futura, **pierde la fecha de su primera reunión**
y migra de cohorte semanal — una semana cerrada hace meses cambia de número sola.

**3. ¿El grupo `oferta` del brief se DEPRECA?** → **NO. Mi recomendación era SÍ y estaba mal.**
Textual: «una oferta es mucho más que un producto… contiene otras cosas que para un dueño de
negocio es importante para poder vender». La oferta no se depreca ni se fusiona: **sube de
nivel**, se vuelve entidad (`ofertas`) con bonos, urgencia, prueba, objeciones y lead magnet.

Y había un argumento de peso que yo no había medido: `perfilNegocioTexto()` alimenta ~20
features y el catálogo `productos` solo 2 (`lib/agente-contexto.ts`) — `lib/mako-context.ts`,
el system prompt de MaKo, **no lee productos en absoluto**. Apagar el grupo hubiera dejado ~18
features sin promesa, precio ni garantía.

El grupo se queda como **declaración inicial**: la fila existe en `ofertas` con los 5 campos en
NULL y `desde_brief = true`, el valor sigue en el blob de `app_settings`, y lo resuelve
`ofertaPrincipal()`. Cero copia, cero desincronización. La tarjeta «Oferta» del hub **no se
retira**.

---

## 6. Lo que NO entra en este plan

- **Assets por producto (landing / VSL / anuncios / A/B) — #210.** No hay ni una columna hoy. El
  `funnel_id` en las tablas existentes entra en F4, pero la **gestión** de assets es un proyecto
  propio. Ojo: #210 está en el board bajo «Vender MaKo: Landing y VSL», que es el marketing
  propio de MaKo, no el del cliente.
- **La tabla `activos` con ruteo automático por `meta_ad_id`/UTM/instancia de WhatsApp.** Es el
  modelo correcto a dos años, pero pedirle al cliente que tipee ids de anuncios es la config
  manual que venimos sacando. Cuando entre, el sistema mira lo que YA llega en los leads y
  propone «estos anuncios están entrando a este embudo, ¿lo confirmás?». Mientras tanto:
  `funnel_origen='default'` y se cambia a mano.
- **Avatares / razones / matriz / lead magnet / persona / voz por producto.** Hoy los cinco son
  blobs únicos en `app_settings`. Lectura de esta corrida: avatares, persona y voz son del
  **negocio**; razones y lead magnet son por **producto**. Sacarlos de `app_settings` arrastra
  Ads Writer entero: fase propia.
- **El embudo visual de `/comercial`** (`app/comercial/page.tsx:453-477`), clavado a 4 etapas con
  clip-paths. Ya da 0 en los cuatro para un funnel sin reuniones, **sin necesidad de
  multi-producto**. Bug propio, no de este plan.
- **Un deal con DOS productos.** Un lead tiene un `monto_cierre_usd` y las cuotas de `pagos` no
  referencian producto. La puerta futura es `pagos.producto_id`.
- **El DROP de `funnel_config`.** Push aparte, después de verificar en prod que `funnels` tiene
  una fila por cada fila vieja. Nunca junto con 0125.
- **`pipeline_stages`**, tabla muerta que sigue en `TENANT_TABLES` y en `TABLAS_RESET`. Borrarla
  es limpieza, no este plan — pero **no la reuses**.

---

## Antes de la primera migración

1. **Nada de esto está verificado contra la base.** Contar filas en `productos` (para el unique
   de 0126) y en `funnel_config` (para la copia de 0125) antes de aplicar.
2. **Un push no es un deploy:** verificar con `vercel ls` que el build esté verde ANTES de
   aplicar la migración. Orden estricto 0125 → 0126 → 0127 (la 0127 tiene FK contra `funnels.id`).
3. **No existe proyecto «Productos» en el catálogo cerrado del board**
   (`lib/plan-proyectos-catalogo.ts:77-186`), y la palabra «oferta» ya mandó #210 al proyecto
   equivocado. Decidir dónde caen estas tareas antes de cargarlas.
