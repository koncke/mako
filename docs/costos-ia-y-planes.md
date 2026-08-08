# Costos de IA y planes — el análisis antes de poner precios

Responde la tarea **#338** del plan («Calcular el costo de tokens e infraestructura por
usuario Free») y es el insumo de **#313** (límites y recarga), **#391** (freemium) y
**#312** (BYOK como beneficio del plan anual).

Los números salen de `anthropic_usage` en producción, **no de estimaciones**: 2.249
llamadas, 23,4M tokens, 5 workspaces, del 29/06/2026 al 08/08/2026 (41 días).

---

## Lo que más muerde acá

1. **Con el consumo actual, el plan que pierde plata es el Pro, no el Free.** Un
   workspace intensivo cuesta ~US$68/mes de IA → margen **−45%** a US$47.
   → [El número que manda](#el-número-que-manda)
2. **La mitad del costo está tapada por free tiers que no escalan.** Son límites por key
   y por día. Si se agotan, el mismo consumo pasa de US$67 a US$99/mes.
   → [El free tier tapa la mitad](#el-free-tier-tapa-la-mitad-del-costo)
3. **Hoy es imposible saber cuánto gastó cada cliente en Claude.** `wsDeProveedor()`
   escribe *todas* las filas de Anthropic en el workspace 1, a propósito. Es el
   bloqueante #1 del medidor. → [Bloqueante A](#a-el-gasto-de-claude-no-es-atribuible)
4. **No existe ninguna primitiva que corte una llamada por gasto.** `ia-cuotas` reordena
   proveedores, nunca bloquea. El enforcement hay que escribirlo entero.
   → [Bloqueante D](#d-no-existe-ninguna-primitiva-de-denegación)
5. **Lo que hoy contiene el gasto es un accidente, no un techo.** Un cliente sin key
   propia no gasta: la llamada **explota**. El día que la plataforma sirva su propia key
   —que es lo que MaKo Tokens implica— seis caminos automáticos empiezan a facturar de
   golpe. → [El gasto automático](#la-ia-que-se-dispara-sola)
6. **Tres módulos gastan sin registrar y siempre contra la key de la agencia.** Ese gasto
   no está adentro de los US$93,50: el baseline es un **piso**.
   → [Los puntos ciegos](#los-tres-puntos-ciegos)

---

## El número que manda

| | |
|---|---|
| Costo real del período (41 días) | **US$93,50** |
| Volumen | 23,4M tokens · 2.249 llamadas · 5 workspaces |
| Concentración | US$93,37 en Claude (Sonnet 5 + Opus 4.8) |
| Un workspace intensivo | **~US$68/mes** de IA paga |

Contra los precios propuestos:

| Plan | Precio | Margen bruto con un usuario intensivo |
|---|---|---|
| Pro | US$47 | **−45 %** — se pierde plata en cada uno |
| Growth | US$97 | **30 %** — insostenible para SaaS |

Presupuesto de IA para sostener un 75 % de margen bruto: **US$11,75/mes** en Pro y
**US$24,25/mes** en Growth. Ese es el techo que tiene que imponer el medidor.

### Costo por acción, medido

Costo real de las llamadas que efectivamente se pagaron (no el promedio con las gratis):

| Acción | Feature | US$/llamada |
|---|---|---|
| Extraer tareas de una reunión | `plan-fathom` | 0,2065 |
| Analizar una llamada de venta | `closing` | 0,1729 |
| Retro / experimentos | `experimentos` | 0,0989 |
| Un mensaje a MaKo por WhatsApp | `mako-doer-in` | 0,0886 |
| Priorizar un lote de tareas | `mako-guardian` | 0,0728 |
| Estructurar campaña de Meta | `campaign-suggest` | 0,0711 |
| Descripción + checklist | `checklist-coach` | 0,0396 |
| Analizar un anuncio | `ads-analyst` | 0,0284 |

⚠️ **`plan-fathom` no es una llamada por reunión.** `CHUNK_CHARS = 25000`
(`lib/plan-fathom.ts:593`) trocea el transcript: una reunión de 2 h son 4-5 llamadas con
`maxTokens: 32000`, más la fusión de duplicadas y las preguntas de contexto. Por eso 427
llamadas salen de un puñado de reuniones. **Al cotizar, el precio va por reunión, no por
llamada** — si no, el mismo trabajo cuesta distinto según lo largo que hablen.

---

## El free tier tapa la mitad del costo

Se pagaron US$91 y se consumió como si se pagaran US$136. La diferencia son 9,1M de
tokens en Gemini/Groq/Mistral, cuyos límites son **por key y por día** (Gemini: 250
pedidos/día). No escalan con la cantidad de clientes.

| Escenario | US$/mes |
|---|---|
| Lo que se paga hoy (free tiers en $0) | 66,84 |
| Mismo ruteo, sin free tier | 70,19 |
| **Se agota el free tier y todo cae a Sonnet** | **99,33** |
| Disciplina de ruteo (Opus → Gemini pago) | 46,36 |
| Piso: todo Gemini Flash pago | **11,98** |

**El ruteo vale 8×.** Es la palanca más grande que hay, más que cualquier límite. Y
encaja con la regla ya escrita en [hallazgos-ia.md](hallazgos-ia.md): «la cascada por
costo es Gemini → Groq → OpenAI, y Claude no es default de nada».

⚠️ **Obstáculo:** los overrides de modelo son **globales del dueño**
(`lib/model-registry.ts:99` lee la setting corriendo en `OWNER_WS`). No hay dimensión de
workspace ni de plan. Hoy **no se puede rutear el Free a barato y dejar Opus en Growth**
sin tocar código.

### Proyección de flota — 100 Free + 30 Pro + 10 Growth (ingreso US$2.380/mes)

| | Costo IA | Margen |
|---|---|---|
| Sin límites, ruteo actual | US$1.700 | 29 % |
| Sin límites, muere el free tier | US$3.010 | **−26 %** |
| **Con límites por plan** | US$760 | **68 %** |

---

## La IA que se dispara sola

Son 18 crons y 6 webhooks. **Seis caminos disparan IA sin que nadie apriete nada**, y
cinco iteran *todos* los workspaces activos vía `lib/cron-workspaces.ts`, que filtra por
integración conectada — **no por plan ni por lista blanca**.

| Camino | Disparador | Techo | Costo proyectado |
|---|---|---|---|
| Webhook de Fathom → post-llamada | La agenda del cliente | **ninguno** | 10 calls/día ≈ **US$52/mes** |
| Cron `closing-sync` | 1×/día, 6 análisis Opus/ws | 6/día | ≈ **US$31/mes/cliente** |
| Cron `fathom-plan` | 13×/día, 3 reuniones/corrida | 39 reuniones/día | el feature más caro medido |
| Cron `doer-flush` | **cada minuto**, barre todos los ws | — | escala con WhatsApp |
| Webhook de Evolution | Cada mensaje de grupo | `maxSteps` 8 | escala con WhatsApp |
| Cron `ads-analyst-sync` | 1×/día, 6 análisis Sonnet/ws | 6/día | escala con los creativos |

El webhook de Fathom es el peor caso: **US$52/mes de un plan de US$47**, disparado por un
tercero, sin cap ni dedup (`app/api/webhooks/fathom/route.ts:152`).

### Lo que hoy contiene el gasto es un accidente

`lib/anthropic.ts:89` resuelve la key con `credWs('ANTHROPIC_API_KEY')`, y
`lib/credenciales.ts:131` solo cae a `process.env` **si el workspace es el 1**. Un cliente
sin key propia no gasta: la llamada **tira error**.

Eso no es una cuota ni un techo — es una consecuencia de la arquitectura BYOK. **El
modelo MaKo Tokens implica servirle la key de la plataforma a todos, y en ese momento los
seis caminos de arriba empiezan a facturar de golpe.** Gatear el plan tiene que estar
*antes* de ese cambio, no después.

### Buenas noticias verificadas

- El **motor de nutrición** (9 corridas/día sobre todos los ws) y `crm-automatico`
  **no llaman IA**.
- El **onboarding completo** de un cliente nuevo —incluido el plan de arranque— corre por
  `chatCheapCascade`, que no tiene ninguna rama hacia Anthropic (`lib/ai-cheap.ts:287`
  termina en `return ''`). **Un Free que se registra y no vuelve cuesta ~US$0 de Claude.**
- Los 3 crons de reportes no iteran workspaces (hoy corren solo para el dueño).

Lo que hay que gatear no es el alta: es **el momento en que el cliente conecta Fathom,
Meta o Evolution**, que es cuando arrancan los crons y los webhooks.

---

## Los cuatro bloqueantes del medidor

### A. El gasto de Claude no es atribuible

```ts
// lib/anthropic-usage.ts:22-25
async function wsDeProveedor(provider?: string | null): Promise<number> {
  if (!provider || provider === 'anthropic') return OWNER_WS;   // ← siempre ws1
  try { return (await getWorkspaceActual()) ?? OWNER_WS; } catch { return OWNER_WS; }
}
```

`recordUsage` tiene `provider = 'anthropic'` por default y los dos call-sites de
`lib/anthropic.ts` (`:125`, `:256`) no lo pasan. **Toda fila de Claude se escribe con
`workspace_id = 1`, venga del workspace que venga** — incluso de un cliente con su propia
key BYOK, que `credWs` sí resuelve por workspace.

Fue una decisión explícita y está documentada en el módulo («key ÚNICA de la agencia,
compartida → SIEMPRE OWNER_WS»), correcta en el mundo pre-BYOK. Hoy tiene dos
consecuencias:

- **El dato «99,9 % del costo cae en ws1» no prueba que ws1 lo haya generado.** Para las
  filas de Claude —US$93,37 de US$93,50— el `workspace_id` es una constante, no una
  medición. El agregado es sólido; el reparto por cliente, no.
- `getUsageSummary` lee las filas de Anthropic **siempre** con
  `.eq('workspace_id', OWNER_WS)` (`:229`): cualquier cliente que abra /integraciones ve
  el gasto de la agencia, y **ninguno puede ver el suyo**.

Sin arreglar esto no hay medidor por workspace del proveedor que es el 99 % del gasto.

### B. Falta el índice `(workspace_id, created_at)`

`anthropic_usage` tiene índices en `(created_at DESC)`, `(workspace_id)` y
`(provider, created_at desc)` — ninguno compuesto. Un chequeo de cuota por workspace y
período escanea de más a medida que la tabla crece. Precedente literal para copiar:
`supabase/migrations/0061` sobre `leads`.

### C. Las lecturas de consumo ya están truncadas

`.limit(20000)` **no sube el techo de 1000 filas de PostgREST** — el repo ya lo tiene
documentado en [hallazgos-infra.md](hallazgos-infra.md). Afecta
`lib/anthropic-usage.ts:229,231` y `lib/ia-cuotas.ts:53`; ninguna usa
`lib/supabase-paginado.ts`.

Como el orden es `created_at DESC`, lo que se pierde son las filas **viejas**: el gasto
subestima y el saldo restante **sobreestima**. Con ~650 filas de Anthropic al mes todavía
no muerde, pero la ventana de lectura solo crece (`agregarCarga` congela el `setAt` de la
primera carga para siempre) y no hay purga de la tabla.

### D. No existe ninguna primitiva de denegación

`ordenarPorCuota` (`lib/ia-cuotas.ts:86-93`) devuelve
`[...no-agotados, ...agotados]` — la misma cantidad de proveedores que entró. El
comentario lo dice: «Nunca los saca: solo los manda al final».

**No hay en todo `lib/` una sola rama que corte una llamada por dinero gastado.** El
único freno son presupuestos **por corrida** en `closing.ts:704` y `ads-analyst.ts:502`,
que topean una invocación del cron, no a un cliente: nada impide que el cron corra al día
siguiente. `saldo-ia-bajo` avisa, no corta. `lib/rate-limit.ts` es en memoria por
instancia y se pierde en el cold start.

---

## Los tres puntos ciegos

Tres módulos llaman a una API paga **sin registrar nada** y **siempre contra la key de la
agencia** (`envCred` resuelve contra `OWNER_WS`, nunca `credWs`):

| Módulo | Qué llama | Alcance |
|---|---|---|
| `lib/embeddings.ts:27` | `text-embedding-3-small` | **una por cada búsqueda del RAG** (`mako-knowledge.ts:190`) |
| `lib/transcribe.ts` | whisper-1 ×2, gpt-4o-mini, gpt-4o visión | cron `transcribe-ads` + 3 rutas a demanda, hasta 25 MB |
| `app/api/ads-manager/analyze-creatives` | gpt-4o visión, hasta 8 imágenes | **sin guard de rol**; el catch devuelve `ok:true` |

Verificado: `grep -c 'recordUsage\|recordSttUsage'` da **0** en los tres.

Dos consecuencias: **los US$93,50 son un piso**, no un total; y un cliente BYOK igual le
cuesta plata a la agencia por estos caminos.

### El registro tampoco es confiable como base de un límite

- **Fire-and-forget:** los 6 registros de `lib/ai-cheap.ts` son `void` sin `await`. En
  serverless la instancia puede congelarse con el INSERT en vuelo. (`lib/anthropic.ts` sí
  awaitea — el camino de Claude es el confiable.)
- **Se traga el error:** `insertUsage` envuelve todo en try/catch con `console.warn`, y
  **nunca lee el `{ error }` que devuelve supabase-js**. Un rechazo de RLS o una violación
  de constraint se pierden sin ningún log.
- **Un fallo de lectura se lee como «cero uso»** — el sentido más caro del error.
- **`cost_usd` no es medición sino tabla hardcodeada:** modelo no listado = precio de Opus
  (`gpt-4o` no está en `PRICING`), y todo Gemini/Groq se guarda en $0 *por pertenecer a
  una lista*, no por el tier real. **Si MaKo Tokens se deriva de `cost_usd`, hereda las
  dos distorsiones.**

A favor: **no hay streaming a ningún modelo** (verificado: los tres `stream: true` del
repo son `TextDecoder` del cliente y un SSE propio), así que el `usage` siempre llega
entero y medir post-hoc es fiable.

---

## Lo que ya existe y no hay que construir

1. **`anthropic_usage` es un ledger completo por llamada** — workspace, provider, feature,
   model, motivo, 4 contadores de tokens y `cost_usd NUMERIC(12,6)`.
2. **El molde de gating ya está construido:** `lib/capas.ts` (catálogo de datos puros,
   fail-closed, con CHECK en la base) + `requireCapa`/`requireRolWs` en
   `lib/tab-access.ts`. **Un plan Free/Pro/Growth es ese mismo molde con otra columna.**
3. `app_settings` con PK `(workspace_id, key)` ya guarda saldos por workspace.
4. `lib/ia-cuotas.ts` ya lee consumo diario por proveedor y por workspace, y ya tiene el
   concepto de umbral y el gauge en /integraciones.
5. `lib/supabase-paginado.ts` ya resuelve el techo de 1000 filas.

No hay Stripe ni nada de billing en el código. **Ojo:** `app_settings` hace
read-modify-write no atómico — bug ya pagado en este repo (migración `0113:13`), que se
resolvió mudando el estado a una tabla con índice único. **Un contador de créditos debe
seguir ese camino, no el de `app_settings`.**

---

## La propuesta: MaKo Tokens

**1.000 MaKo Tokens = US$1 de costo real de IA.** La unidad es *costo*, no tokens de
modelo: así se puede cambiar de modelo sin rehacer los planes.

### Menú

| Acción | Costo real | Precio |
|---|---|---|
| Extraer tareas de una reunión | $0,2065 | **210 MT** |
| Analizar una llamada de venta | $0,1729 | **175 MT** |
| Retro / experimentos | $0,0989 | **100 MT** |
| Un mensaje a MaKo por WhatsApp | $0,0886 | **90 MT** |
| Priorizar un lote de tareas | $0,0728 | **75 MT** |
| Estructurar campaña de Meta | $0,0711 | **75 MT** |
| Descripción + checklist | $0,0396 | **40 MT** |
| Analizar un anuncio | $0,0284 | **30 MT** |

### Asignación

| Plan | Cupo | Qué alcanza | Margen bruto |
|---|---|---|---|
| Free | 1.500 MT | 7 reuniones | — |
| Pro US$47 | 12.000 MT | 57 reuniones · 133 mensajes | **74 %** |
| Growth US$97 | 25.000 MT | 119 reuniones · 277 mensajes | **74 %** |

Con esos cupos, la proyección de flota da **68 % de margen** en vez de 29 %.

### Dónde se aplica

`presupuestoRestanteHoy(ws)` chequeado **antes** del fetch en cinco lugares:
`lib/anthropic.ts:89` y `:229`, `lib/ai-cheap.ts:144` y `:425`, más el camino nuevo de
`transcribe`/`embeddings`.

⚠️ **El chequeo tiene que ser pre-flight, nuevo.** Los `recordUsage` existentes son
posteriores a la llamada y fire-and-forget: sirven para contabilizar, **no para gatear**.

---

## Orden de trabajo propuesto

Nada de esto es la pantalla de Pricing: es lo que la tiene que sostener.

1. **Arreglar la atribución de Claude por workspace** (bloqueante A). Sin esto el medidor
   le cobra todo a ws1.
2. **Tapar los tres puntos ciegos** — `credWs` + `recordUsage` en `embeddings`,
   `transcribe` y `analyze-creatives`. Sin esto el cupo se evade por tres puertas.
3. **Hacer el registro verificable** — leer el `{ error }` del insert, `await` (o `after()`
   de `next/server`, patrón que el repo ya usa) los 6 call-sites de `ai-cheap`, y que un
   fallo de lectura sea un error explícito y no un cero.
4. **Índice `(workspace_id, created_at)`** + pasar las 3 lecturas a `supabase-paginado`.
5. **Tabla de créditos** con índice único (no `app_settings`) + `presupuestoRestanteHoy(ws)`.
6. **Gate por plan en los 6 caminos automáticos**, antes de servir la key de la plataforma.
7. **Modelo por plan** — `model-registry` necesita dimensión de workspace/plan.
8. Recién ahí: pasarela, pantalla de Pricing y el copy.

---

## Salvedades honestas de este análisis

- **La muestra es dogfooding, no clientes pagos.** 41 días, y el consumo es casi todo del
  workspace de la agencia. Sirve para el **techo de un usuario intensivo**, no para el
  promedio. El costo del usuario típico recién se sabe con clientes reales.
- **El reparto por workspace de Claude no es medición** (bloqueante A). El agregado de
  US$93,50 sí es sólido.
- **US$93,50 es un piso.** No incluye los tres puntos ciegos ni tres scripts CLI que
  llaman a Opus 4.8 directo sin registrar (`scripts/backfill-closing.mjs:109`,
  `backfill-script-analyst.mjs:131`, `closing-v2-analyze-api.mjs:63`).
- **Los precios de los modelos cambian.** Los de este documento son de agosto de 2026.

**Vive en:** `lib/anthropic-usage.ts` · `lib/anthropic.ts` · `lib/ai-cheap.ts` ·
`lib/ia-cuotas.ts` · `lib/model-registry.ts` · `lib/transcribe.ts` · `lib/embeddings.ts` ·
`vercel.json` · plan #338, #313, #391, #312
