# Múltiples productos, múltiples funnels — plan

Estado: **propuesta**, con 3 decisiones abiertas al final que cambian el diseño.
Salió de una corrida de 15 agentes el 2026-08-10 (`~productos-x-funnels`). Los hallazgos
que la sostienen están en [hallazgos-crm.md](hallazgos-crm.md) → «El funnel: de dónde salen
las etapas» y en [hallazgos-onboarding.md](hallazgos-onboarding.md) → «El estado del wizard».

Contexto: #374 (catálogo de productos), #363 (venta recurrente, cerrado), #210 (assets por
producto), #186 (escalera de valor). Decisiones ya cerradas por el dueño que **no se
revuelven**: elegir producto al cerrar es obligatorio (con «Otro/personalizado»), el
catálogo vive en el ONBOARDING y no en Configuraciones, el alta es de a una pregunta por
pantalla, y la IA COMPLETA con lo ya cargado en vez de re-preguntar.

---

## 1. Dónde estamos de verdad

- **El catálogo `productos` está construido y no lo usa nadie.** Tabla (`0117_productos.sql:16-31`),
  CRUD (`lib/productos.ts:45-82`), `TENANT_TABLES` y RLS: todo eso existe. Pero
  `leads.producto_id` (`0117:34`) no la lee ni la escribe **una sola línea de TypeScript**, y
  `seedProductosDesdeOferta()` (`lib/productos.ts:89-109`) no tiene **un solo call-site**. La
  mitad declarada de #374 —«el deal hereda el pricing del producto»— no existe.
- **La puerta de entrada al catálogo está rota hoy.** El paso `'productos'` está en
  `PasoOnboarding` y en el orden de la capa `completo` (`lib/capas.ts:24,116`), la pantalla se
  pinta (`OnboardingWizard.tsx:607`), pero la clave **no existe** en `OnboardingState.steps`
  ni en `estadoInicial()` (`lib/onboarding-state.ts:56-70,85-99`) ni en el union `Body.step`
  (`app/api/onboarding/route.ts:167`). `s.steps['productos'].done = true` es un TypeError
  sobre `undefined` → 500, no persiste nada, y el cliente no mira `ok`
  (`OnboardingWizard.tsx:388-389`): avanza igual y al volver aterriza siempre en productos.
- **«Múltiples funnels» no existe en ninguna capa.** `grep funnel_id` en todo el repo: cero.
  La base lo prohíbe (`0054_workspaces.sql:95`) y hay tres escritores que upsertean con
  `onConflict:'workspace_id'`.
- **Lo que sí está bien:** el MODELO ya es multi-funnel-ready. `generateFunnel`,
  `salidasDeEtapa`, `mergeFunnelData`, `sanearPipeline` y los templates reciben el pipeline
  **por parámetro** y no tocan Supabase. Lo acoplado a «hay uno» son las funciones de acceso
  de `lib/leads.ts`, no el modelo.

---

## 2. La decisión de modelo

### Tabla `funnels` nueva, con PK propia. No se altera `funnel_config` y no se guardan N funnels adentro de un jsonb.

**Por qué no «todo adentro del jsonb»:** guardar `data.funnels[]` con el principal espejado
arriba es guardar el mismo dato dos veces, en un repo cuya primera regla es que la segunda
copia se queda vieja. Peor: el editor autoguarda el jsonb **entero** con debounce de 500 ms
por tecla (`FunnelEditor.tsx:136-142`); dos personas editando dos funnels distintos se
pisan enteras. Con filas separadas eso está aislado por construcción.

**Por qué no «ALTER a `funnel_config` para que acepte N filas»:** dropear
`funnel_config_ws_uk` rompe los **tres** upserts con `42P10`, y como la migración y el
deploy son pasos separados hay una ventana garantizada en la que todo guardado de funnel
falla. La tabla nueva es la única opción **aditiva**: `funnel_config` queda intacta y
funcionando durante toda la transición.

```sql
-- 0125_funnels.sql
create table funnels (
  id           bigint generated always as identity primary key,
  workspace_id bigint not null,
  producto_id  bigint null references productos(id) on delete set null,
  nombre       text not null,
  canal        text null,          -- CanalId; el canal BAJA del negocio al funnel
  plantilla    text null,          -- de qué FUNNEL_TEMPLATES se sembró
  data         jsonb not null default '{}'::jsonb,  -- MISMA forma que funnel_config.data
  declarado    boolean not null default false,      -- = el origen 'declarado' vs 'sin-fila'
  es_default   boolean not null default false,
  activo       boolean not null default true,
  orden        int not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index funnels_ws_default_uk on funnels(workspace_id) where es_default;
create index idx_funnels_ws on funnels(workspace_id);
create index idx_funnels_producto on funnels(producto_id);
-- RLS + revoke a anon/authenticated (molde de 0118_rls_tablas_abiertas.sql)
```

Tres decisiones adentro, las tres para **no reescribir lo que funciona**:

- **`data` conserva la forma exacta de `funnel_config.data`** (`{pipeline, suppressed,
  entradas, evento, umbrales}`). `mergeFunnelData`, `sanearPipeline`, `parseEntradas` y
  `parseEvento` se reusan sin tocar una línea, y el contrato de MERGE que impide que un
  tecleo borre `umbrales` se hereda.
- **`declarado` es el `origen` de hoy convertido en columna.** Un workspace sin fila recibe
  la suya con `data='{}'` y `declarado=false` → sigue cayendo a `DEFAULT_PIPELINE` con
  `entradas` vacío. Cero cambio de comportamiento, y ningún prompt empieza a afirmar un
  funnel que nadie declaró.
- **`umbrales` pasa a ser por funnel.** Hoy es un lector sin escritor (`crm-auto.ts:47-64`):
  sale gratis y es lo correcto — un producto de ciclo corto y un high-ticket no comparten días.

**Cardinalidad: 1 producto : N funnels, con `funnels.producto_id` nullable. No tabla puente.**
El pedido es literalmente «N funnels por producto», que es exactamente una FK. Un N:M vuelve
ambiguo «¿qué producto es este lead?» justo donde el CRM necesita una respuesta.
`producto_id = null` = funnel transversal (prospección fría), que es un estado válido y
declarado, no un error.

### El lead: dos columnas que son dos hechos distintos

```sql
-- 0127_leads_funnel.sql
alter table leads add column if not exists funnel_id bigint references funnels(id);
alter table leads add column if not exists funnel_origen text;  -- 'manual' | 'default' | …
```

- `funnel_id` = **por dónde ENTRÓ**. Se escribe en la entrada (webhook / instant form / landing / import).
- `producto_id` (ya existe, muerta) = **qué se VENDIÓ**. Se escribe al cerrar.
- `funnel_origen` es la misma disciplina que `FunnelConfig.origen`: la ficha **dice** por qué
  le tocó ese funnel en vez de afirmarlo.

El upsell ya tiene casa sin tabla puente: `leads.producto_id` (lo que se cerró) puede diferir
de `funnels.producto_id` (lo que el funnel vende por defecto).

### Las stage keys NO se prefijan

El ámbito lo da `leads.funnel_id`, no el nombre de la key. Prefijar invalidaría todos los
`leads.pipeline_stage` guardados, todo `lead_audit` y `leads.etapa_vista` (`0122:26`). Las 11
canónicas de `deriveStageKey` (`lib/pipeline.ts:887-904`) se declaran catálogo cerrado
(`ETAPAS_CANONICAS`) y significan lo mismo en todos los funnels.

### El precio es SNAPSHOT, no JOIN

El producto **siembra** `venta_tipo`/`monto_cierre_usd`/`suscripcion_*` al cerrar; esos campos
del lead (mig 0116) siguen siendo la verdad histórica y el MRR sigue saliendo de ahí
(`lib/queries.ts:739-770`). `producto_id` es **solo la dimensión para agrupar**. Si mañana
subís el precio, la venta del año pasado no cambia.

### La capa de IA: un solo lugar

Hoy el mismo bloque de funnel está copiado **tres veces** (`campaign-structurer.ts:144-147` ·
`landing-analyst.ts:345-348` · `landing-writer.ts:150-153`) más `resumenFunnel()`
(`mako-context.ts:51-67`). Con N funnels eso se vuelve incorregible. Se colapsa en:

- **`lib/oferta-contrato.ts` — SIN `server-only`** (mismo criterio que `lib/model-catalogo.ts`
  y `exigirClienteDePrueba`: la regla que más duele si falla va donde un test la pueda
  importar). Exporta `OfertaFoco` (producto + funnel + hermanos + `origen`), `ofertaTexto()` y
  `catalogoTexto()`.
- **`lib/oferta-contexto.ts` — CON `server-only`**: `resolverOferta({leadId?, funnelId?,
  productoId?})`, guard en **positivo** y fail-closed, con `null` explícito y
  `ofertaTexto(null)` = *«Todavía no hay una oferta declarada; preguntá antes de suponerla»*.

La unidad de contexto es el **PAR (producto, funnel)**: el producto tiene el QUÉ (promesa,
precio, garantía), el funnel el CÓMO (entrada, evento, canal, etapas). Un writer necesita los
dos o escribe mal.

---

## 3. Las fases

**Orden obligatorio: F0 → F1 → F2 → F3. F4 no puede quedar después de que un cliente real
pueda crear su segundo funnel. F5 y F6, en cualquier momento después de F3.**

### F0 — DESTRABAR · sin migración · prerrequisito de todo

Hoy el paso de productos no persiste, el reset arrastra catálogo viejo y «Completar como
Mauricio» entrega un negocio sin catálogo. Sin F0, todo lo demás se prueba contra un
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

### F1 — La tabla `funnels`, sin cambio de comportamiento · migración 0125

Es el andamio de todo lo demás. La 0125 copia `funnel_config` → `funnels` de forma no
destructiva (una fila `'Funnel principal'` por workspace, `declarado=true` si tenía fila,
`'{}'`/`false` si no) y **`funnel_config` no se toca**: queda como respaldo.

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

### F2 — Catálogo con casa propia y N funnels por producto · migración 0126

`productos` suma `slug` y `updated_at`, más
`unique (workspace_id, lower(btrim(nombre)))` — la segunda capa determinista del dedup que hoy
solo vive en la prosa del prompt. ⚠️ Necesita saneo previo que renombre colisiones con sufijo:
**contar filas en prod antes de aplicarla.**

- Pantalla `/productos` con `Pagina` + `PageHeader` + `Section` y entrada en `lib/nav.ts`.
  Lista con filete, no pila de tarjetas, y **no `.mk-fila`** (esa lleva la marca dorada de
  «acá intervino MaKo»; un catálogo comercial no lo es).
- Vista producto → funnels en **carriles** (uno por producto, una tarjeta por funnel, click →
  modal). Molde: `MatrizView.tsx:3-23,270-278`. La tabla producto×funnel está descartada por
  escrito ahí mismo: obliga a que todos tengan la misma cantidad y rellena con «—».
- Wizard «Agregar un funnel» con `WizardShell` usando **`pasos`+`pasoActual`** (el MAPA), no
  `total`/`idx`: tiene ramas, y `total`/`idx` es el antipatrón que el propio shell documenta
  (`WizardShell.tsx:26-42`). Tres preguntas cerradas: producto → canal (siembra con
  `templateDeCanal`) → nombre prellenado.

**Terminada cuando:** se cargan 3 productos, uno tiene 2 funnels editables por separado, y con
**un solo** funnel la pantalla se ve exactamente como hoy (el selector ni se pinta).

### F3 — El lead sabe su funnel y su producto · migración 0127

`leads.funnel_id` + `funnel_origen` + backfill al default de cada ws (es la verdad histórica:
entraron por el único funnel que había) + índices. **`producto_id` NO se backfillea**:
asignarle un producto a un cierre viejo sería inventar un dato declarado.

- `resolverFunnelDeLead(lead)` **fail-closed al default** (null o id desconocido → el default,
  **nunca «todos»**). La función pura va en `lib/funnel-ruteo.ts` **sin `server-only`**, con
  test: es el guard que más duele si falla.
- Board: `app/crm/page.tsx:68-94` pasa `funnels[]`, píldoras con `flex-wrap` (nunca scroll
  lateral), filtro **server-side** por `funnel_id`.
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

**Terminada cuando:** cerrás un deal, elegís producto, el tipo/monto/plazo vienen sembrados, y
el board filtra por funnel sin que ningún lead viejo cambie de etapa.

### F4 — Los consumidores dejan de mentir · migración 0128 · bloqueante de F2 en producción

**Regla dura: `nutricion_secuencias.funnel_id` tiene que estar en el MISMO release en que un
cliente real pueda crear su segundo funnel.** Es el único riesgo del proyecto que sale de la
pantalla y le llega a un lead: `leadsDeCohorte('etapa_actual')` trae todos los leads abiertos
del ws y filtra en memoria por `pipelineStageOf` (`lib/nutricion.ts:310-313`). Dos funnels con
`'noshow_r1'` se cruzan **mensajes reales de WhatsApp y email**, sin error y sin log.

0128: `funnel_id` en `nutricion_secuencias`, `whatsapp_template_drafts`,
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

### F6 — Reportes por producto · migración 0129

`v_cohortes_semanales`/`v_cohortes_mensuales` (`0084:23-33,58-68`) con `producto_id` y
`funnel_id` en el GROUP BY, y `getMrrActivo` agrupando (`lib/queries.ts:739-770`). ⚠️ Las
vistas están en `TENANT_TABLES`: hay que conservar `workspace_id` en la salida o el CRM se
queda sin métricas. Y en el **mismo commit**, `lib/queries.ts:416-462`: partir cada semana en N
filas hace que `cohortes_maduras_count: cohortes.length` empiece a contar semana×producto.

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

## 5. Las 3 preguntas abiertas (cambian el diseño)

**1. ¿El canal de venta baja del negocio al funnel?**
Hoy es uno por workspace (`lib/fase-store.ts:29`) y de él salen la plantilla del funnel,
`seGraba`, `agendaElLead` y `encuentroGrabable`. Si un producto se vende por webinar y otro por
llamada, hoy uno arranca con la plantilla equivocada y con las reglas de grabación del otro.
→ **Recomendación: SÍ**, columna `canal` en `funnels` desde 0125, con fallback al canal del
negocio cuando está null. Cuesta una columna ahora y reescribe `ENCUENTRO_POR_CANAL`,
`TEMPLATE_POR_CANAL` y `lib/encuentro-ws.ts` en F4.

**2. ¿Un lead puede correr DOS funnels a la vez (escalera de valor / upsell)?**
`leads` tiene solo **dos** pares de columnas de reunión y `slotPorIndice` devuelve null del
índice 2 en adelante (`lib/funnel-etapas.ts:52-68`).
→ **Recomendación: NO. Un lead = un funnel a la vez.** El upsell se representa con
`leads.producto_id ≠ funnels.producto_id`, y si hace falta el recorrido completo se mueve el
`funnel_id` y queda `funnel_origen='manual'`. Decir que sí obliga a una tabla `lead_funnels` y a
reescribir los slots de reunión: es otro proyecto.

**3. ¿El grupo `oferta` del brief se DEPRECA a favor del catálogo?**
Los 5 campos `oferta_*` (`lib/onboarding.ts:28-34`) los llena El Archivero y se editan en el
área «Oferta» de `/second-brain` **en paralelo** al área «Productos» (`AreasHub.tsx:61,63`). Dos
lugares para el mismo dato, sin sincronía. Y `esCampoDeArchivero()` colapsa un documento que
habla de tres productos en una sola oferta.
→ **Recomendación: SÍ, en dos tiempos.** 0126 lo copia al catálogo; después
`perfilNegocioTexto()` deja de emitir el grupo `oferta` **cuando hay ≥1 producto activo** (guard
en positivo), los 5 campos quedan como fallback del ws que nunca cargó catálogo, y la tarjeta
«Oferta» del hub se retira.

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
