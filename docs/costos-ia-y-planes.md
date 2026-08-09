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
7. **El tope de tokens NO alcanza para el plan gratis**: acota el costo pero no produce una
   decisión. Va con plazo, y con dosis DIARIA, no bolsa mensual.
   → [El plan gratis](#el-plan-gratis-el-tope-de-tokens-no-alcanza)
8. **El carrito directo no cierra a US$47 y el cobro en LATAM se come el 45% del
   checkout** — y el mismo problema vuelve en cada rebill, lo que baja el techo de CAC de
   US$104 a US$55-70. → [El CAC de los dos canales](#el-cac-de-los-dos-canales-y-el-impuesto-que-nadie-ve)

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

## El plan gratis: el tope de tokens NO alcanza

*Corrida `pricing-paso-1-con-que-ia`, 2026-08-09. Responde la pregunta textual del dueño:
«¿le meto además de una restricción de funcionalidades una restricción de tiempo, como una
prueba gratuita, o basta con dejar la restricción de tokens? ¿Cómo lo hacen otras apps?».*

**Respuesta corta: no alcanza, porque las dos restricciones resuelven problemas
distintos.**

- El **tope de créditos** acota el COSTO, pero no produce una decisión: el usuario tibio
  nunca llega al tope y se queda gratis para siempre.
- El **plazo** no acota ningún costo (un usuario intenso quema inferencia en 3 días), pero
  es lo único que fija una FECHA de compra.

Por eso el patrón del mercado es **«X créditos o N días, lo que ocurra primero»**: Adobe
(Experience Cloud AI termina el trial al consumir el otorgamiento de 10.000 AI Credits),
Customer.io (los créditos introductorios expiran a los 90 días, los comprados no) y Orb lo
documenta como estándar de facturación.

### La métrica que engaña y la que decide

SaaS Conversion Report (enero 2026, **n=200 productos B2B**, ChartMogul + Growth Unhinged
+ ProductLed) — la única fuente del lote con muestra y metodología publicadas:

| Mecánica | Conversión free→pago | Por cada 1.000 visitantes |
|---|---|---|
| Freemium clásico | 3-5% bueno / 8-12% excelente | 90 registros → **5 pagos** |
| Freemium sin registro | 7-9% / 8-12% | 70 registros → **5,6 pagos** |
| Trial sin tarjeta | 4-6% / 10-15% | 45 registros → **3,6 pagos** |
| **Trial CON tarjeta** | 25-35% / 50-60% | 35 registros → **10,5 pagos** |
| Reverse trial | 4-6% / 8-12% | — |

⚠️ **No elegir por el % de conversión: es la métrica que más engaña.** Se elige por
*clientes pagos por cada 1.000 visitantes*, que es lo que paga la campaña. El trial con
tarjeta rinde **el doble** que el freemium **con un tercio de los usuarios gratis** — que
en un producto con costo marginal real es la única mecánica que baja el volumen de
gratuitos y sube los pagos al mismo tiempo.

⚠️ Sobre el reverse trial: Poyar aclara explícitamente que la muestra era chica y **la
diferencia con freemium NO es estadísticamente significativa**. No es mágico.

Contexto de mercado (mismos 200 productos): trial por tiempo 57%, freemium 26%, reverse
trial 7%. **14 días en el 62%** de los trials. Solo el 20% pide tarjeta. Y los productos
AI-native usan trial por tiempo bastante menos que el SaaS clásico (43% vs 61%): cuanto
más IA tiene el producto, menos se apoya en el reloj y más en el consumo.

### Los SaaS con costo real de inferencia ya sacaron la IA del plan gratis

Verificado en las páginas de precios oficiales el 9/8/2026:

| Producto | Qué hace con la IA en el gratis |
|---|---|
| **HubSpot Marketing** | Plan Free real (US$0, 2 usuarios, sin tarjeta) con **CERO créditos de IA**. Aparecen en Starter (500) y Professional (3.000). La funcionalidad es gratis; la IA no |
| **Jasper** | No tiene plan gratis. Solo 7 días de trial sobre Pro |
| **Copy.ai** | Eliminó el plan gratis. El escalón más bajo es US$29/mes |
| **Lovable** | Free forever, pero con tope **DIARIO**: 5 créditos/día, máx. 30/mes, **no acumulables** |
| **ElevenLabs** | La excepción: 10.000 créditos por mes renovables. Funciona porque ahí **el volumen ES el producto** |

*(Gamma y ManyChat quedaron sin verificar: sus páginas devuelven 403. ManyChat es el
comparable más cercano por canal y precio — vale abrirlo a mano en el navegador.)*

⚠️ **Tope diario, no bolsa mensual.** Una bolsa mensual se quema entera el día 1, con un
pico de inferencia concentrado y sin ningún compromiso del usuario, y deja 29 días de
cuenta muerta. El tope diario aplana el gasto, hace imposible el abuso por ráfaga y genera
el hábito de volver. Es lo que hace Lovable y lo que hace el free tier de Gemini.

### El diseño recomendado para MaKo

1. **Reverse trial de 14 días** con todo desbloqueado y una bolsa de MaKo Tokens. Termina
   con lo que ocurra primero. Los 14 días son el estándar que nadie tiene que explicar.
2. **Sin tarjeta en el canal WhatsApp; con tarjeta en el canal carrito.** Son dos públicos
   distintos y no hay que elegir: son dos puertas.
3. **Al vencer NO se cierra la cuenta:** se cae a un Free permanente que conserva CRM,
   board, funnel, contactos y lo ya generado (costo marginal ~0, y **el dato del cliente
   queda adentro**), con una dosis DIARIA mínima de IA que no se acumula (3-5 acciones/día).
   Molde HubSpot + tope diario de Lovable.
4. **El Free nunca toca el modelo caro.** El modelo bueno es una razón para pagar, no un
   derecho adquirido. → esto necesita el bloqueante «modelo por plan» del orden de trabajo.
5. **Una cuenta gratis por teléfono verificado**, reusando el OTP de WhatsApp que ya existe
   (`lib/mako-grupo.ts`). Sin esto el free se recicla infinito y la inferencia la paga la
   agencia. En un producto con costo marginal real esto no es higiene: es margen.
6. **El aviso es parte del diseño:** al 80% de tokens y a 3 días del vencimiento, MaKo
   avisa por WhatsApp —el mismo canal por el que entró— mostrando lo que hizo y lo que se
   pierde. La aversión a la pérdida es el único motor real del reverse trial.

⚠️ **Lo que NO hay que hacer: un free forever con tokens que se renuevan todos los meses.**
Es el modelo de ElevenLabs y funciona ahí porque el valor ES el volumen. En MaKo el valor
es el resultado: una PyME se queda viviendo en el gratis para siempre, cómoda, y la
inferencia la paga la agencia sin fecha de vencimiento.

**El margen manda la palanca.** El margen bruto objetivo mediano de la IA es **50%** contra
70-80% del SaaS tradicional (*State of B2B SaaS and AI Monetization*, Growth Unhinged,
13/5/2026, n=230). a16z recomienda subsidiar la PRUEBA, no el acceso gratis permanente, y
Lovable dice tratar su freemium agresivo como **gasto de marketing, no centro de costo** —
la única forma honesta de justificar regalar inferencia: presupuestada como CAC, con techo.
De ahí sale la métrica de gobierno: *costo de inferencia regalada por cliente pago
adquirido*. Si se acerca al margen del Pro, **se achica el tope diario del free** — por eso
tiene que ser un parámetro configurable desde el día uno, no una constante.

---

## El CAC de los dos canales, y el impuesto que nadie ve

*Misma corrida. Reemplaza el «US$666 por reunión de venta» que estuvo mal en la tab de
pricing: salía de un benchmark de SDR y **MaKo no vende por llamadas**, vende self-serve.*

> **Veredicto: el canal WhatsApp cierra contra el techo del Pro. El carrito directo a
> US$47 no.**

**Canal (a) — CTWA → free → pago.** `CAC = costo_conversación / (conv→registro × free→pago)`

| conv→registro | free→pago 3% | 6% | 10% |
|---|---|---|---|
| 20% | $250 | $125 | $75 |
| 30% | $167 | **$83** | $50 |
| 40% | $125 | $63 | $37 |
| 60% | $83 | $42 | $25 |

Caso base (30% × 6%) = **CAC US$83**: entra en el techo laxo del Pro (US$104), no en el
estricto (US$53). Caso bueno (40% × 8%) = US$47: entra en los dos. Invertido: el producto
de las dos tasas debe superar **1,44%** para el techo de $104 y **2,83%** para el de $53.
Para el Growth los umbrales caen a 0,77% y 0,39% — casi imposible de fallar.

**Canal (b) — carrito directo.** CPC B2B ~US$1,00 en México, checkout frío 0,8-1,5%,
aprobación de pago 70-88% → **CAC US$76-179**. Rompe el techo del Pro en casi toda la
banda; entra cómodo en el del Growth (US$194-381).

→ **Decisión operativa: vender Growth o anual en el carrito, y rutear el Pro mensual a
WhatsApp.** Es ruteo de campaña, no de producto: la misma landing, distinto objetivo. Y la
palanca que multiplica el techo en vez de mejorarlo al margen es el **cobro anual**: un
anual de US$470 (12 meses al precio de 10) mueve el techo de CAC de $104 a más de $700.

### Cuatro cosas que cambian el resultado y no estaban en la pregunta

1. **Meta regala 72 horas de mensajería en click-to-WhatsApp.** Confirmado en su
   documentación oficial: si el usuario inicia desde un anuncio CTWA y se responde dentro
   de las 24h, se abre una ventana «Free Entry Point» de **72h desde la respuesta** en la
   que se puede mandar cualquier tipo de mensaje sin cargo. **El costo de mensajería del
   canal es cero si el chatbot cierra el registro adentro de la ventana** — el diseño del
   bot deja de ser UX y pasa a ser economía unitaria. Instrumentar una alerta cuando una
   conversación cruza la hora 60 sin registro.
2. ⚠️ **El cobro en LATAM es un impuesto invisible al CAC.** Solo ~28% tiene tarjeta de
   crédito; México tiene 0,19 tarjetas de crédito per cápita contra 0,99 de débito; las
   transacciones **cross-border aprueban al 65-75%** contra 85-92% de los rieles locales; y
   ~45% del tráfico se pierde en el checkout **por pago fallido**. Pasar de 70% a 88% de
   aprobación baja el CAC del carrito de US$119 a US$95 — 20% menos sin tocar el anuncio.
   Se ve como «conversión baja», nunca como «cobro roto».
3. ⚠️ **Y pega dos veces: el rebill también falla.** La aprobación cross-border no aplica
   solo al primer cobro. Si el fallo de renovación suma 3-5 puntos al churn voluntario de
   SMB self-serve (3-7% mensual), el churn efectivo pasa de ~5% a 8-10% y la vida útil cae
   de ~20 meses a 10-12. **Eso corta el LTV casi a la mitad y con él el techo de CAC: el
   $104 real sería más bien US$55-70 mientras se cobre solo con tarjeta internacional.** Y
   se lee como «los clientes se van». → separar churn voluntario de involuntario **desde el
   día 1**; juntos, este problema es indetectable.
4. ⚠️ **Meta optimiza por conversaciones baratas, no por registros.** Puede bajar el costo
   por conversación de US$1,50 a US$0,60 mientras hunde conv→registro de 30% a 10%: el CAC
   sube de $83 a $100 **y el dashboard dice que mejoró**. La corrección es mandar el evento
   de registro (y el de pago) por Conversions API. MaKo ya tiene la integración con Meta y
   los webhooks: es cableado, no arquitectura.

### El número que decide todo, y que no publica nadie

De los cuatro eslabones de la cadena, tres tienen benchmark público y uno no:

| Eslabón | ¿Hay dato? |
|---|---|
| Costo por conversación | Sí — reconstruido desde el CPM, ver abajo |
| Costo de mensajería | Sí, y es **cero** (ventana de 72h) |
| free → pago | Sí — mediana 8%, freemium bueno 3-5% |
| **conversación → registro** | **NO EXISTE dato público.** Verificado |

Y es la variable de mayor apalancamiento: con free→pago del 6%, si conv→registro es 20% el
CAC es $125 (falla) y si es 40% es $63 (entra en los dos techos). **El mismo gasto
publicitario, el doble de resultado, y la diferencia está entera en el guion del chatbot** —
que es el único eslabón que MaKo controla al 100%. Umbrales exactos a US$1,50/conversación
con free→pago 6%: **≥24% para CAC ≤$104, ≥47% para CAC ≤$53**.

⚠️ **El costo por conversación: US$1,50, no US$0,40.** Lo que circula para LATAM
(€0,20-0,60) es de moda, belleza y alimentos con audiencias amplias, sin muestra ni
metodología. No existe dato público para audiencia B2B hispanohablante. Reconstruido desde
el CPM, que sí es auditable: audiencia amplia México da US$0,30-0,50 (coincide con lo
publicado, lo que valida el método), pero **audiencia B2B estrecha sube el CPM a
US$10-14 y baja el CTR: US$1,10-2,30 por conversación**. Banda de planificación
US$0,80-2,50, base **US$1,50**. Usar US$0,40 sería un error de 4x.

### Claims que NO deben entrar a la proyección

Aparecen repetidos en toda la web de vendors de WhatsApp y son justamente los que harían
que este negocio cerrara trivialmente:

- «92% menos costo por lead y 94% más conversión que una landing» → estudio de Forrester
  **encargado por Meta**. Material del vendedor.
- «CTWA convierte 10-20% de los clics en ventas» → un orden de magnitud fuera de cualquier
  cosa medida en SaaS, sin fuente primaria.
- «Los chatbots de WhatsApp convierten 28% de los leads», «comercio conversacional 45-60%»
  → sin metodología, sin muestra, y midiendo compra de ecommerce, no alta en un SaaS.
- Toda la familia de «benchmarks 2026» con cifras sospechosamente precisas (opt-out retiene
  28,4%, reverse trial convierte 38,4%): páginas generadas para SEO, se contradicen entre
  sí y contradicen al estudio de 200 productos que sí tiene metodología.

**Y los benchmarks de CAC en USD son de mercado estadounidense.** El ajuste a LATAM no es
dividir todo por el ratio de CPM: la ventaja de medios **sí** se traslada (EE.UU. US$23,00
de CPM contra México US$4,50, más de 5x), pero las tasas de conversión de landing y de
free→pago **no mejoran** por estar en LATAM —si acaso empeoran, porque US$47/mes pesa más
sobre el ingreso local— y la fricción de cobro es **peor**. MaKo hereda la ventaja de costo
y también las desventajas. El neto sigue siendo favorable, pero un cálculo que solo aplique
el descuento de CPM sobreestima.

### Lo que hay que medir con dinero propio

Cuatro datos que **no existen públicamente** — verificado. Los cuatro se resuelven con
US$300-500 de gasto real en México y Colombia (los CPM más baratos con poder de compra en
USD: MX US$4,50, CO US$4,00; evitar España, casi el doble):

1. Costo por conversación CTWA para audiencia B2B en LATAM hispanohablante.
2. Conversación → registro vía chatbot.
3. Free → pago segmentado por origen WhatsApp.
4. CAC de un SaaS de US$47-97 vendido en LATAM. No hay benchmark. Ninguno.

Dos semanas de gasto real valen más que cualquier benchmark ajeno. **Instrumentar
conversación→registro ANTES de gastar el primer dólar**, con el link de alta trackeado por
conversación, y testear 2-3 guiones de chatbot en paralelo desde el día 1.

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
