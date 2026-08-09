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
7. **Con el producto completo el costo ya no es el texto, es el video.** Re-ruteado, extraer
   una reunión pasa de US$0,93 a US$0,002 (436×) y la mitad de las acciones caen a cero;
   pero los medios son el **90%** del costo del Growth, que se pasa de su techo.
   → [El producto completo](#el-producto-completo-el-costo-deja-de-ser-el-texto-y-pasa-a-ser-el-video)
8. **El tope de tokens NO alcanza para el plan gratis**: acota el costo pero no produce una
   decisión. Va con plazo, y con dosis DIARIA, no bolsa mensual.
   → [El plan gratis](#el-plan-gratis-el-tope-de-tokens-no-alcanza)
9. **Se venden DOS planes, no tres**: el gancho del Growth (Image y Video Generator) es
   `ComingSoon`, y un tercer plan vacío no es un ancla de precio, es un reembolso. Y **no
   existe alta de usuario ni de workspace**: no hay nada entre el «gracias por tu compra» y
   el primer login. → [El diseño de los planes](#el-diseño-de-los-planes-se-venden-dos-el-tercero-se-anuncia)
10. **El carrito directo no cierra a US$47 y el cobro en LATAM se come el 45% del
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

## El producto COMPLETO: el costo deja de ser el texto y pasa a ser el video

*Paso 2, 2026-08-09. Base: las 122 áreas de `app/admin/dev/areas.ts` — **55 cerradas, 29 a
medias, 38 por construir** — con los precios verificados del paso 1. Los números viven en
`app/admin/dev/pricing/modelo.ts` (`RERUTEO`, `ACCIONES_NUEVAS`, `PERFILES`).*

⚠️ **Dos tipos de número conviven acá y no valen lo mismo.** El **costo unitario** es
`publicado` (sale de la página del fabricante). La **cantidad mensual** es `supuesto` — la
pusimos nosotros, es discutible, y es la palanca de todo el resultado.

### Lo que ya existe, re-ruteado: el texto se derrumba

| Acción | Hoy (medido) | Con el ruteo del paso 1 | |
|---|---|---|---|
| Extraer tareas de una reunión de 2 h | US$0,9293 | **US$0,0021** | **436×** |
| Un mensaje a MaKo por WhatsApp | US$0,0886 | US$0,0011 | 78× |
| Analizar una llamada de venta | US$0,1729 | US$0,0108 | 16× |
| Estructurar una campaña de Meta | US$0,0711 | US$0,0127 | 6× |
| Priorizar un lote de tareas | US$0,0728 | **US$0** | gratis |
| Descripción + checklist de un lote | US$0,0396 | **US$0** | gratis |
| Validar una plantilla de WhatsApp | US$0,0400 | **US$0** | gratis |
| Analizar un anuncio | US$0,0284 | **US$0** | gratis |
| Retro / experimentos | US$0,0989 | US$0,0989 | **no se mueve** |

El 436× de la reunión no es un modelo más barato: es que **Qwen3.7-Flash tiene 1M de
contexto y la reunión entra entera**, así que desaparecen las 4-5 llamadas del troceo. Es
exactamente el problema documentado en [hallazgos-ia.md](hallazgos-ia.md) → Topes.

La Retro es la única que **no** se mueve, a propósito: es el único análisis cuya salida
gobierna decisiones de plata.

### Lo que falta construir: 22 acciones nuevas que gastan

De las 38 áreas por construir, las que consumen IA son 6 analistas nuevos (Competitor Spy,
Offer / VSL / Chat / CS / YouTube Analyst), 6 de Sales Machine (VSL Generator, Lead Magnet,
Sales Email, Newsletters, Closing Script, Sales Roleplay), 8 de Content Machine (Ideas,
Image, Video, Reels, Carousels, Stories, YouTube Writer, Thumbnails) y 2 agentes.

| | Una unidad de cada acción |
|---|---|
| Las 16 de **texto** | **US$0,23** |
| Las 6 de **medios** | **US$3,22** (capa barata US$1,26) |

**Los medios son 14× el texto entero, con seis acciones contra dieciséis.**

Las unidades que importan: imagen US$0,034 (barata US$0,015) · clip de video de 8 s
US$0,40 (barata US$0,15) · **Reel de 15 s con 3 intentos y voz US$2,45** (barata US$0,95) ·
carrusel de 7 imágenes US$0,238.

⚠️ Los 3 intentos no son pesimismo: en creativos publicitarios nadie acierta al primero, y
ningún modelo genera 15 segundos de una — son 2 clips más un stitch. Es la arquitectura, no
una optimización pendiente.

### El costo mensual por cliente, con el producto completo

| Plan | Precio | Costo de IA | Margen | Techo al 75% |
|---|---|---|---|---|
| Free | US$0 | **US$0,02** | — | — |
| Pro | US$47 | **US$1,87** (barata US$1,15) | 96% | US$11,75 ✅ |
| Growth | US$97 | **US$27,40** (barata US$12,60) | **72%** | US$24,25 ⚠️ |

> **El Growth se pasa del techo, y el 90% de su costo son medios: US$24,58 de US$27,40.**
> Un solo Reel de 15 segundos cuesta más que TODO el texto del plan Pro en un mes entero.

Supuestos del Growth que producen ese número: 20 clips de video, 4 Reels, 80 imágenes, 40
stories, 8 carruseles y 12 thumbnails por mes. **Ninguno está medido.** Si un cliente hace
40 clips en vez de 20, el costo pasa de US$27 a US$35 y el margen cae debajo del 65% — y
hoy no hay nada que lo impida.

### La consecuencia, que es de diseño de planes y no de ingeniería

1. **El video no puede ser una feature incluida.** Tiene que ser una unidad medida y
   visible: «te quedan N videos», no «generación de video ✓». Es la única línea del costo
   que un usuario puede multiplicar por diez sin darse cuenta.
2. **El Free es gratis de verdad** si no toca medios: US$0,02/mes. El molde de HubSpot
   (funcionalidad gratis, IA paga) no es una concesión — acá es literalmente el diseño que
   los números piden.
3. **El Pro respira**: US$1,87 contra un techo de US$11,75. Hay espacio para meterle
   analistas de texto sin tocar el precio, porque el texto ya no cuesta.
4. **La capa barata del paso 1 vale exactamente donde duele.** Baja el Growth de US$27,40 a
   US$12,60 — la mitad del costo, y toda la diferencia está en los medios. Pero es la capa
   que tiene el problema de términos de reventa (ver [hallazgos-ia.md](hallazgos-ia.md) →
   Comprar modelos): **el ahorro es real y el riesgo contractual también**.

---

## BYOK vs MaKo Tokens: dos economías, y la línea no pasa por donde parecía

*Paso 3, 2026-08-09. Corrida de 12 agentes: 5 frentes (código, mercado, economía, 4º plan,
riesgo legal) + un escéptico por frente + crítico de completitud + síntesis.*

### El veredicto

**BYOK no es una palanca de precio: es una casilla de gobernanza.** Va en el Growth de
US$97, **sin tocar el precio**, y **solo para texto**. Ahorraría como máximo US$2,82 de los
US$27,40 del Growth: el 90% restante son medios, y ahí el BYOK está **prohibido por
contrato**.

**No hay 4º plan.** Todavía, y sobre todo no por BYOK.

### La prohibición que cierra la discusión de los medios

fal.ai, textual (ToS act. 31/07/2026): *«You may not share or permit others to use your
individual account credentials»*. Replicate dice lo mismo.

Un cliente que pega su key de fal en MaKo para que MaKo la use es **exactamente eso**. Y
son justo los dos proveedores que el paso 1 eligió por ser los únicos cuyos términos
contemplan un SaaS. O sea: el BYOK de medios viola el contrato del único camino limpio.

De los cinco contratos de LLM leídos (OpenAI, Google, Groq, Anthropic, fal) **ninguno
prohíbe explícitamente** que un tercero opere la key del titular — pero ninguno lo bendice,
y los cinco cargan el 100% de la responsabilidad sobre el titular. La lectura correcta no
es «no se puede»: es **«si sale mal, no hay a quién reclamarle»**. Vercel y OpenRouter
operan BYOK a escala hace años sin que nadie los frene.

⚠️ **Falta chequear Vertex (service accounts) y Bedrock (IAM):** ahí la delegación es un
mecanismo diseñado a propósito y probablemente sea el único BYOK contractualmente limpio.

### Las dos economías

| | **MaKo Tokens** (key de MaKo) | **BYOK** (key del cliente) |
|---|---|---|
| Quién paga la inferencia | MaKo, y la revende con margen | El cliente, a **precio de lista** |
| Quién responde ante el proveedor | MaKo | El cliente |
| A quién suspenden si algo viola política | A MaKo, y caen **todos** los clientes | Solo a ese cliente |
| Texto (post-ruteo barato) | US$2,82/mes en Growth | Se lo lleva el cliente |
| **Medios** | US$24,58/mes en Growth | **Imposible: prohibido** |
| Qué le cuesta al cliente empezar | Nada | ~US$30-35 inmovilizados, créditos que **vencen a los 365 días y no se reembolsan** |

**Los costos que NO se mueven de lado:** la orquestación (Vercel + Supabase + el ruteo) y
—el que sorprende— **el storage y el egress de los medios generados**. Es el único COGS que
**crece** con BYOK: si al cliente le sale más barato generar, genera más, y todo aterriza
en tu bucket. Sin tope de almacenamiento, BYOK convierte un costo acotado por el plan en
uno sin techo.

### El patrón del mercado, unánime en tres cosas

Ocho productos con BYOK documentado, todos verificados en su página oficial el 9/8/2026:

1. **Nadie inventó un tier para BYOK.** Zapier: «Pro and Advanced plans only». Gumloop:
   «Requires Pro plan or higher». Cursor: cualquier plan pago. Warp lo da **hasta en el
   Free** y lo gatea por tamaño de organización — señal de que es una casilla de compras,
   no una feature premium.
2. **Nadie baja el precio.** Y los tres diseños de fee **se contradicen, no se promedian**:
   Vercel AI Gateway cobra **0%**, OpenRouter **5%**, Gumloop **duplica** su fee de
   orquestación (8% → 16%) justamente porque perdió el margen del token, y Cursor suma
   US$0,25/M de tokens encima del BYOK.
3. **Lo que baja es la moneda interna.** Zapier: tu key consume tareas 1x en vez de 5x.
   Gumloop: 459 créditos → 93. El mensaje es «tu cuota rinde 5 veces más», nunca «te cobro
   menos».

⚠️ **El fee de Gumloop es inaplicable acá.** Cobra un % *sobre lo que la corrida habría
costado* — y en MaKo esa corrida cuesta US$0,0021, así que el 16% da **cero**. Si se cobra
un fee, la base tiene que ser **por acción**, no por costo evitado.

### Las cuatro reglas del BYOK, si se construye

1. **Solo texto.** Video e imagen siempre con key de MaKo.
2. **Solo FUERA del pipeline ruteado.** Este es el que más ahorra: el ruteo barato **es el
   producto**. Si el cliente pone su key de OpenAI en el pipeline, paga 436× más por el
   mismo trabajo y te culpa a vos. Es lo que le pasó a Cursor — no retiró BYOK, lo
   **vació**: hoy «custom API keys only work with chat models» y el Agent lo rechaza por
   diseño.
3. **Se vende como control, no como ahorro.** «Tus prompts van por tu cuenta, tu factura,
   tus logs». El break-even de texto es **negativo** para el cliente: ahorra US$2,82/mes y
   le cuesta ~US$2,90/mes de crédito prepago que se vence.
4. **Exige saldo mínimo de MaKo Tokens**, y el fallback cuando la key del cliente se agota
   consume tokens, con aviso en el momento. Es el diseño de Vercel, textual: *«that
   fallback usage is billed against your credits balance»*.

### Por qué NO hay 4º plan: las tres premisas que lo empujaban se caen

| Premisa | Por qué se cae |
|---|---|
| «El Growth se pasa del techo de 75% de margen» | **El 75% es un supuesto de la era SaaS.** La mediana publicada de margen bruto de un producto de IA es **50%** (Poyar, n=230, abr-may 2026), y solo el 12% apunta a 80%+. El 72% del Growth está **22 puntos ARRIBA** de la mediana de su categoría |
| «Arriba de US$250 se retiene 70%» | El dato de ChartMogul es real, pero la banda de precio es atributo de la **empresa**, no del cliente dentro de un producto. Dice «las empresas que PUEDEN cobrar caro retienen mejor», no «si subís de US$97 a US$297 vas a retener mejor». El propio reporte atribuye la fuga al bajo costo de cancelar |
| «Un plan caro hace ver barato al Growth» | **El efecto señuelo no replica** con estímulos realistas: Frederick/Lee/Baskin y Yang/Lynn, *JMR* 51(4) 2014 — 91 intentos, 23 categorías, solo 11 con efecto confiable |

⚠️ **El criterio correcto no es el margen promedio: es que ningún CLIENTE INDIVIDUAL quede
en margen negativo.** US$27,40 es un promedio; el que hace 20 Reels cuesta US$49.

**Qué se hace en lugar del 4º plan:** tope de MaKo Tokens en el Growth con corte duro,
packs de overage con margen (el Reel extra a ~US$5, 2× sobre costo), y 60-90 días de
medición. Si aparece un pelotón que revienta el tope todos los meses y compra packs sin
quejarse, esa gente dice sola el precio y el contenido del 4º plan.

**Si después de medir hay 4º plan, el ancla es AGENCIA (multi-workspace), no BYOK, a
US$297.** Múltiplos medidos en páginas oficiales: GoHighLevel US$97→US$297 = 3,06× (compra
multi-subcuenta) y US$297→US$497 = 1,67× (compra revender); Zapier 3,45×; HeyGen 1,69× y
3,04×; respond.io 2,01× y 1,75×. **No existe regla de 2× ni de 3×: el rango real es
1,7×-3,4×.** US$247 da 2,55×, no cae en ningún patrón observado y no tiene comparable que
el comprador reconozca — descartarlo. MaKo ya es multi-inquilino por dentro (mig 0054 y
0058), así que un plan de agencia es costo de UI y de gating, no de arquitectura.

### El problema del video lo arregla el TOPE, no el BYOK ni un plan más caro

El argumento es aritmético y no necesita fuente: **si sacás un plan de US$297 con más
video, el cliente que hoy quema US$49 de video dentro del Growth de US$97 no se muda.** Se
queda donde está, porque ahí le sale más barato. Un tier nuevo captura al que ya está
topeado; **no defiende el margen de abajo**.

Y el BYOK tampoco: además de prohibido, **Veo no tiene tier gratis** — Veo 3.1 Lite es
US$0,05/seg a 720p, o sea que el clip de 8s a US$0,40 **ya es precio de lista**. La key del
cliente no ahorra un centavo por unidad.

**Nadie vende video sin tope self-serve:** HeyGen capea créditos en **los cinco** tiers
(Free 3 videos · Creator US$29 = 600 · Pro US$49 = 1.000 · Business US$149 = 1.500);
respond.io capea por tier con overage a US$15/1.000 créditos y **corte al 200%** del
allowance.

**Diseño del tope:** MaKo Token = **US$0,01**, la misma unidad que HubSpot (packs de 1.000
por US$10) para que la comparación sea legible. Multiplicador **inverso** al costo: texto
**0 tokens** (medirlo cuesta más que hacerlo, y «texto ilimitado» es el diferencial contra
HubSpot, que cobra 50 créditos por conversación), imagen 9, clip de 8s 88, Reel de 15s 490.
Cupo del Growth ≈ 2.450 tokens/mes, corte duro al 200%. **Dimensionar el N con el costo de
fal.ai/Replicate, no con la capa barata.**

---

## El diseño de los planes: se venden DOS, el tercero se anuncia

*Paso 4, 2026-08-09. Corrida de 12 agentes: grilla de features, mensual vs anual, precio
neto, cupo de tokens y clientes existentes, cada uno con su escéptico.*

### La decisión que ordena todo: el Growth no se puede cobrar todavía

Su gancho entero —**Image Generator y Video Generator**— son `estado: 'por-construir'` en
`app/admin/dev/areas.ts`, con un `page.tsx` de 8 líneas que monta `<ComingSoon>`
(verificado). **Un tercer plan vacío no es un ancla de precio: es un reembolso.** La grilla
tiene tres columnas y **dos botones de compra**; el Growth va como lista de espera con el
precio anunciado.

### El eje que separa los planes, en una línea

> **El Free no conecta ninguna integración con webhook ni cron.**
> Free = la IA corre cuando apretás un botón. Pro = corre mientras dormís.

No es una cantidad ni un feature suelto: se corresponde exactamente con la curva de costo.
Hay seis caminos que gastan sin que el usuario entre a la app, y el peor —el webhook de
Fathom, disparado por la agenda de un tercero, sin dedup ni tope— proyecta US$52/mes contra
un plan de US$0.

Y **usuarios 1/3/10, no «ilimitados»**: GoHighLevel puede regalarlos porque un usuario más
no le cuesta nada; en MaKo cada usuario es una boca de gasto de IA. **Un solo workspace en
los tres**, porque el multi-workspace es el ancla del plan Agencia de US$297.

### Lo que se saca de la grilla porque no existe

38 de 122 áreas están en `por-construir`. Nada de esto puede aparecer en la landing, ni
como bullet. Y **tres trampas peores que un ComingSoon**, porque figuran como listo/parcial
y se venderían sin querer:

- **Second Brain** está `listo` pero su propio alcance dice que todavía no conecta señales
  ni saca conclusiones. No venderlo como «conecta las señales de tu negocio».
- **Nutrition Writer** y **Post-Call Follow-up** escriben el borrador, **no mandan**. Falta
  el go-live del envío. No venderlo como «responde solo».
- **CRM Automation** está hecho pero gateado por `crmAutoHabilitado`, que es fail-closed:
  se puede vender, pero **hay que prenderlo en el alta** o el cliente compra algo que nunca
  arranca.

### Mensual vs anual: Pro 16,7%, Growth 8,3%

| | Mensual | Anual | Descuento |
|---|---|---|---|
| **Pro** | US$47/mes | **US$470/año** (US$39/mes) | 2 meses gratis · 16,7% |
| **Growth** | US$97/mes | **US$1.067/año** (US$89/mes) | 1 mes gratis · 8,3% |

**El 20% es cartel publicitario, no práctica.** Verificado el 9/8: GoHighLevel 16,67%
exacto; Systeme.io «2 months free»; Jasper dice «Save ~20%» y son 14,5% reales; HubSpot
10,1%; **respond.io muestra «Save up to 20%» y sus precios anuales son 12× el mensual
clavado — cero descuento, todo el trabajo lo hace el «up to»**.

⚠️ **Por qué el Growth descuenta la mitad:** el mismo porcentaje de precio se come distinto
porcentaje de margen. 16,7% sobre el Pro son US$7,85 contra un margen de US$40,20 = 19,5%
del margen; sobre el Growth son US$16,17 contra US$68,29 = 23,7%. **No se copia un
porcentaje entre planes con estructuras de costo distintas.**

### El precio NETO: Paddle, y lo del CFDI era un falso problema

**Paddle como merchant of record**, balance y payout en USD, precios listados «+ IVA».
Es más barato que Stripe directo arriba de US$33 de ticket: Paddle 5% + US$0,50 contra
Stripe 2,9% + US$0,30 + 1,5% internacional + 0,7% Billing + 0,5% Tax = **5,6% + US$0,30**.
Stripe Managed Payments es el MoR más caro del mercado (8,6% + US$0,30).

| | Lista | Cobrado (con IVA MX) | **Neto** | Costo IA | **Margen sobre IA** |
|---|---|---|---|---|---|
| Pro mensual | US$47 | US$54,52 | **US$43,77** | US$3,57 | **91,8%** |
| Pro anual | US$470 | US$545,20 | **US$442,24** | US$3,57 | 90,3% |
| Growth mensual | US$97 | US$112,52 | **US$90,87** | US$22,58 | **75,1%** |
| Pack 1.000 MT | US$15 | US$17,40 | US$13,63 | ≤US$4,17 | ≥69% |

**El fijo de US$0,50 es la palanca del anual:** pesa 1,06% sobre US$47 y 0,11% sobre
US$470. Doce cobros mensuales del Pro cuestan US$38,76 de fee; uno anual, US$27,76.

> **¿Sobrevive el Pro a US$47? Sí por producto, no por carrito.** US$41,90 de contribución
> contra US$3,57 de IA no es un problema de precio. El techo de CAC sobre neto es US$49-97
> y el carrito mide US$76-179. **No toques el precio del Pro: arreglá el carrito, o vendé
> el anual.**

⚠️ **El CFDI no bloquea.** Una empresa extranjera no puede emitir CFDI, pero existe la
**regla 12.1.4 de la RMF**: el prestador extranjero inscripto entrega un PDF con el IVA
trasladado por separado y con eso el receptor mexicano lo acredita. **Paddle está en el
padrón del SAT (RFC PML120808ITA, alta 10/11/2021), posición 182 del listado del quinto
bimestre 2025. Stripe y Lemon Squeezy no figuran.** En el copy no prometer «factura
fiscal»: decir «comprobante con IVA desglosado, acreditable según regla 12.1.4 RMF», y
poner el campo **RFC / NIT** en el checkout.

⚠️ **Y por eso no se vende «rápido con Stripe» mientras tanto:** el reloj de **30 días
naturales** para inscribirse en el RFC arranca con la primera venta a un mexicano, sin
monto mínimo, y exige representante legal y domicilio **en territorio nacional**.

⚠️ **Argentina es segunda ola.** A un monotributista el Pro le aparece **~US$71** (21% de
percepción de IVA + 30% a cuenta de Ganancias); a un responsable inscripto, ~US$61 y le
cuesta US$47. Rebill resolvería cobrando en ARS, pero tiene **mínimo de US$500/mes** para
cuentas que no procesan US$50.000 mensuales.

### El agujero de WhatsApp, cerrado: es casi cero

1. **El anuncio click-to-WhatsApp abre una ventana gratis de 72 horas**, textual de Meta.
   Como el canal principal *es* CTWA, toda conversación que cierra en 3 días cuesta US$0.
   Lo que se paga es la reactivación fuera de la ventana: US$0,0305 la plantilla en México.
2. **El WhatsApp que consumen los clientes no es COGS de MaKo:** `lib/chatwoot.ts` resuelve
   las cuatro credenciales por `credWs` y tira error si faltan — **Meta le factura a la
   cuenta de cada cliente**.

Va presupuestado en CAC, no en producto: ~US$1-3 por lead por mes de reactivación, con tope.

### El cupo: MaKo Tokens SOLO para medios

**1 MT = US$0,01 de precio de lista.** El texto va con uso justo y **no se mide de cara al
cliente**: cuesta US$1,87 y US$2,82 al mes, y poner un contador de tokens de texto en la
cara del cliente mide algo que no cuesta y le enseña a tenerle miedo al producto.

| Acción | Costo real | Precio | Markup |
|---|---|---|---|
| 1 imagen | US$0,034 | 10 MT | 2,9× |
| 1 segundo de video | US$0,05 (Veo 3.1 Lite 720p) | 12 MT | 2,4× |
| Reel de 15 s (3 intentos) | US$2,25 | 540 MT | 2,4× |

| Plan | Cupo | Qué compra |
|---|---|---|
| Free | **60 MT una sola vez** | 6 imágenes. Sin video. Sin recarga |
| Pro | **500 MT/mes** | 50 imágenes. **Sin video** — el video es capacidad del Growth, no una cuota más grande |
| Growth | **5.000 MT/mes** | «300 segundos de video + 140 imágenes, **o cualquier combinación**» |

El «o cualquier combinación» es obligatorio en el copy: sin esa frase, el que quiere 8
Reels y 0 imágenes se siente estafado por una sub-cuota que no existe. Y los MT aparecen
**solo dentro de la app**, con el costo mostrado ANTES de generar y un contador en unidades
(«te quedan 3 Reels»), no en tokens — que es lo que hacen todos los que le venden a
no-expertos: **Synthesia migró oficialmente a créditos y su página de precios sigue
mostrando minutos**.

**Dos reglas que hacen que los números aguanten:** se descuenta por segundo **generado**, no
entregado (nadie acierta al primer intento; si los fallidos no descuentan, cada pieza cuesta
3× y lo paga la agencia); y **los MT no pagan WhatsApp** (meter un pass-through de commodity
adentro de una unidad con markup es cómo se pierde plata en México y se sobre-cobra en
Argentina).

**Al agotarse se frena la generación de medios y nada más.** El CRM, WhatsApp, el copy y los
análisis siguen andando: quedarse sin tokens nunca puede romper el CRM. Es el default de la
industria verificado en cinco — y **respond.io es el único que sigue cobrando, con corte en
seco al 200%**.

**Pack de overage: 1.000 MT = US$15**, mínimo un pack, solo Pro y Growth (mismo precio que
respond.io). **Techo duro al 200% del cupo**: al llegar no se vende más recarga, se sube de
plan. Eso cierra el arbitraje —un Pro que quisiera 5.000 MT pagaría US$114,50, más caro que
el Growth, y además el Pro no puede comprar video a ningún precio— y acota la exposición:
el Growth al 200% factura US$159,02 netos contra US$44,49 de IA, **72% de margen**.

⚠️ **Honestidad sobre el cupo:** el paso 3 modeló el Growth con 20 clips + 4 Reels ≈
US$24,58. Este cupo entrega el equivalente a ~12 clips: **es menos canasta**, y buena parte
del salto de margen viene de haberla recortado. Ese cliente se va a chocar contra el tope
—para eso está— pero se dice así, no como si el margen hubiera aparecido solo. **Recalibrar
contra uso real a los 60 días de que la feature exista.**

### Los que ya están adentro son TRES, y no son los que decíamos

⚠️ **Corrección de hecho.** `docs/mapa-del-proyecto.md:43` dice: `ws1` = Mauricio, `ws3` =
Cliente de Prueba, `ws9` = Martín/super-admin, `ws10` = Leandro, `ws11` = Leila.

La lista que circulaba —«4 workspaces vivos: 3, 9, 10, 11»— **está mal en los dos
sentidos**: incluye el workspace de testing y al propio dueño, y **deja afuera al ws1, que
es un cliente real** y encima el único que comparte la key de Claude con la agencia.
Mandarle el email a esa lista sería escribirle al workspace de prueba y a uno mismo, y
dejar afuera al único cliente mezclado en el medidor.

**Los destinatarios reales son tres: Mauricio (ws1), Leandro (ws10), Leila (ws11).**

Con tres clientes que el dueño conoce por nombre, **el proceso formal es teatro**. Una
llamada de 15 minutos por cliente + un email de constancia de 10 líneas, que es lo que
salva de la discusión «a mí me dijiste que era ilimitado»:

1. «Se te congela el precio y el alcance al 9 de agosto de 2026: todo lo que hoy usás, con
   los límites que hoy tenés.»
2. «Las funciones que se lancen después entran con los límites de su plan, iguales para
   todos.»
3. «El texto te queda sin tope. Los medios van a tener cupo mensual para todos, ustedes
   incluidos.»
4. «Respondeme SÍ para confirmar; si preferís no seguir, te doy de baja sin cargo.»

⚠️ **No prometer «te queda todo ilimitado».** Se grandfatherea lo que existe, nunca lo que
todavía no se escribió. Si el email dice «ilimitado» y en tres meses aparece el botón de
Reels, esos tres son los únicos usuarios sin tope de la feature más cara del producto.
**Sacarle un tope a alguien que nunca lo tuvo es la conversación que Docker y Unity
perdieron; nacer con tope es gratis, porque nadie extraña lo que nunca tuvo.**

### Lo que hay que construir, en orden — y el orden ES el del riesgo

Hoy nada cuesta plata **por accidente**: `credWs` solo cae al env si el workspace es el 1,
así que un cliente sin key propia no gasta, la llamada **explota**. El día que la plataforma
sirva su propia key para que exista el Free, los seis caminos automáticos facturan solos.
Invertir este orden es abrir la canilla y después buscar la llave.

1. **Atribuir el gasto de Anthropic al workspace del request** (`lib/anthropic-usage.ts:15-25`).
   Sin esto ningún tope es implementable, para nadie.
2. Índice `(workspace_id, created_at)` en `anthropic_usage`.
3. **Migración 0125**: `workspaces.plan` + `plan_limites` + `workspace_limites`.
4. **`lib/planes.ts`** — catálogo puro, **fail-closed**: plan desconocido cae al más
   restrictivo (al revés de `capaDef`, que cae a `'completo'`).
5. **El gate DENTRO de cada cron y cada webhook**, escrito en positivo. Los crons iteran
   todos los workspaces y los webhooks resuelven el workspace por el payload de un tercero:
   **no pasan por la sesión**, así que un gate en `capas.ts` esconde tabs y no frena un
   dólar. Es exactamente el caso del Reset que se ofrecía a clientes reales.
6. **`presupuestoRestante(ws)` PRE-FLIGHT**, antes del fetch. Hoy no existe ninguna
   primitiva de denegación por consumo.
7. **Ledger de MaKo Tokens append-only.** El saldo se **deriva de la suma**, nunca se guarda
   un contador mutable: ese bug ya se pagó (la mig. 0113 reemplazó un string de
   `app_settings` que dos invocaciones concurrentes se pisaban).
8. **Paddle**: 4 Prices + pack, `/precios`, `/checkout`, webhook, campo RFC/NIT.
9. **Key de plataforma para el Free. ÚLTIMO.** No antes de 1-6.
10. **Image Generator** primero (10× más barato y más simple que el video, y sus dos insumos
    ya existen), después Video y Reels.

**Y un test que falle si un cron nuevo no filtra por plan**, con la condición en un módulo
sin `server-only` para que el test la pueda importar — mismo criterio que
`exigirClienteDePrueba`. La regla en el prompt de una PR no es una regla.

### Los huecos que quedaron abiertos, y son bloqueantes

1. ⚠️ **No existe alta de usuario ni de workspace.** `app/api/auth/callback/google/route.ts`
   es Google OAuth y nada más: si el email no está en `usuarios`, devuelve `no-autorizado`.
   **No hay nada entre el «gracias por tu compra» y el primer login.** La cadena
   `pago → webhook → crear workspace → asignar plan → invitar → wizard` no la diseñó nadie,
   y es más trabajo que la columna `plan`. Decisión que falta: ¿el signup crea el workspace
   antes o después del pago?
2. ⚠️ **Hay DOS monedas de cupo incompatibles** y ninguna quedó elegida: unidades de negocio
   («30 imágenes/mes») vs MaKo Tokens. No se resuelve con más research — es una decisión de
   producto de 10 minutos que bloquea la redacción de la grilla.
3. ⚠️ **La grilla le pone al Pro «imágenes/mes» y el Image Generator es un ComingSoon.** El
   primer cliente que paga US$47 abre la tab y lee «Próximamente». Es el escenario que más
   enoja y está adentro de la recomendación, no en un riesgo lejano.
4. ⚠️ **No existe ninguna página legal** — ni `/terminos`, ni `/privacidad`, ni
   `/reembolsos`— en un producto que ya tiene landing pública de venta. Un merchant of
   record **aprueba el negocio antes de activarlo** y las pide. Es un gate de días o semanas
   **antes** del primer cobro, no copy de última hora.
5. ⚠️ **Falta el impuesto del que COBRA, no el del que compra.** Qué entidad factura y en
   qué país condiciona todos los netos: si es argentina, el payout en USD entra al régimen
   cambiario y paga Ingresos Brutos. **Sin ese dato ningún margen de arriba es real.**
6. **¿Los tres clientes actuales pagan algo hoy?** `workspaces` no tiene columna de precio,
   plan ni fecha de renovación. Si son acuerdos de agencia, «congelar el precio» no
   significa nada y lo único que se congela es el alcance — y eso cambia qué dice el email.

---

## Lo que este análisis daba por cierto y NO lo es

*Salió del crítico de completitud del paso 3. Cada punto corrige algo escrito más arriba en
este mismo documento.*

1. ⚠️ **El ruteo barato del paso 1 NO está en el código.** Los cuatro modelos —gpt-5.6-luna,
   Qwen3.7-Flash, Kimi K2.6, GLM-4.7-Flash— no aparecen en ninguna línea ejecutable. Lo que
   corre hoy (`lib/ai-cheap.ts:35-65,99-104`) es Groq `gpt-oss-20b`, Gemini
   `gemini-flash-latest`, Cerebras `llama-3.3-70b`, Mistral `mistral-small-latest`,
   OpenRouter `llama-3.3-70b:free`, OpenAI `gpt-4o-mini`. **El 436×, las «4 acciones a
   cero» y el margen del 96% del Pro son proyecciones sobre una configuración que todavía
   no existe.**
2. ⚠️ **Parte de «el texto dejó de costar» es «el texto dejó de medirse».** `costFor`
   devuelve 0 para groq/gemini/cerebras/mistral/openrouter **porque están en una lista**
   (`lib/anthropic-usage.ts:240`), no porque el tier real sea gratis. Medido hoy: los
   workspaces de clientes (3, 9, 10, 11) tienen **1.005 llamadas y 7,5M de tokens
   registrados a US$0,04 en total**. Eso no es barato: es no medido.
3. ⚠️ **El volumen de medios es el supuesto más cargado del análisis y nadie lo derivó.**
   Los US$24,58 son `volumen supuesto × precio verificado`. El precio está bien; el volumen
   no puede derivarlo nadie **porque la feature de medios no tiene una sola línea de
   código**: grep por `fal|replicate|kie|apimart|veo|sora|gpt-image|text-to-video` en `lib/`
   y `app/` da **cero coincidencias ejecutables**. De ese número dependen en cadena el
   margen del 72%, el «90% son medios», el techo de CAC del Growth y el cupo de tokens.
   **Los US$24,58 no son un costo a cubrir: son un producto a construir.**
4. ⚠️ **No existe máquina de cobro.** El único hit de Stripe en todo el repo es un regex que
   tapa claves de Stripe en los logs (`lib/agente-redaccion.ts:49`). No hay `/registro`,
   `/checkout` ni `/precios`, y ninguna migración de plan, suscripción o saldo.
   `0014_pagos_cuotas.sql` es la cobranza de los leads DEL cliente, no la suscripción a
   MaKo. Todo el diseño de overage, packs y corte duro **es billing, y el billing no está
   en ninguna estimación**.
5. ⚠️ **Nadie contó el precio NETO.** El procesador se lleva 3-6% + fee fijo (que sobre
   US$47 pesa), el IVA de servicios digitales es 16% en México y 19% en Colombia, y **una
   PyME mexicana que no recibe CFDI no puede deducir la suscripción** — eso frena la
   conversión al Growth más que cualquier discusión de BYOK. El margen del 96% del Pro está
   calculado sobre el precio de lista, no sobre lo que entra a la cuenta.
6. ⚠️ **El costo variable del canal principal no está en ningún número.** MaKo vende y opera
   por WhatsApp, y Meta cobra por conversación de marketing. En los US$0,02 / US$1,87 /
   US$27,40 **no hay un centavo de WhatsApp**. Tampoco de Supabase, Vercel, egress ni Panda.
7. ⚠️ **Falta la grilla de qué feature entra en qué plan.** En el código no hay
   Free/Pro/Growth: hay dos capas, `pm` y `completo` (`lib/capas.ts`), y `completo` es
   literalmente «todo el producto».
8. ⚠️ **Y falta decidir qué pasa con los clientes que YA están adentro.** Hoy tienen
   `completo` sin tope. Meterles cupo, corte duro y overage es un cambio de contrato hacia
   atrás sobre gente que ya paga. No hay una línea de grandfathering en ningún lado, y es el
   movimiento con más riesgo de churn de todo el plan.

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
