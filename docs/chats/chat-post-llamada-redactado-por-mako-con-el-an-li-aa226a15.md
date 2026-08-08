# Post-llamada redactado por MaKo con el análisis de Fathom

`2026-07-31 15:00` → `2026-07-31 15:20` · 3 mensajes de Martín · 8 respuestas de Claude · sesión `aa226a15`

> Transcripción de la conversación. **No incluye las llamadas a herramientas ni sus resultados** —son el 96% del peso y no son la charla— ni el razonamiento interno de Claude. Las credenciales que aparecían en el texto están **redactadas**; el resumen de qué se hizo en cada sesión está en [chats.md](chats.md).

---

## Martín

`2026-07-31 15:00`

En C:\Users\marti\OneDrive\Escritorio\dashboard-marketing-main\dashboard-marketing: implementar el punto sc18_2 de la tarea #18 del board /plan — "Post-llamada redactado por MaKo con el análisis de la charla". Cuando termina una llamada de venta (webhook de Fathom, app/api/webhooks/fathom/route.ts, matcheada a un lead por lib/closing.ts / Closing Analyst), MaKo redacta el follow-up usando el análisis de la llamada (dolores/objeciones detectados) + la voz del negocio (lib/nutricion-generator.ts: getVozGuia + metodologiaDeArea('mensajes')), y lo deja como BORRADOR a un clic para el setter en wa_borradores (lib/evolution-envio.ts crearBorrador, origen nuevo tipo 'post_llamada') — nunca envío automático directo a leads calientes (regla dura del PDF anti-ban). La infraestructura de borradores, el análisis de closing y el generador ya existen; falta el trigger post-llamada y el prompt específico. Registrar el prompt como editable (skill add-editable-prompt) y dejar rastro en el historial del lead ("MaKo redactó el follow-up post-llamada") — regla de la memoria historial-mako-siempre.

### Claude

Voy a implementar el punto sc18_2: el trigger post-llamada que hace que MaKo redacte un borrador de follow-up tras cada llamada de venta. Primero exploro la infraestructura existente.

### Claude

El proyecto tiene skills propias. Cargo `add-editable-prompt` (obligatoria para el prompt nuevo) y leo la infraestructura existente.


---

## Martín

`2026-07-31 15:01`

Base directory for this skill: C:\Users\marti\OneDrive\Escritorio\dashboard-marketing-main\dashboard-marketing\.claude\skills\add-editable-prompt

# Agregar un prompt editable (registro central de MaKo)

Todo prompt de MaKo debe pasar por el registro para que Martín pueda editarlo en
`/configuraciones` sin tocar código. Un prompt hardcodeado que no está en el
registro queda MUDO a la edición (key drift = el usuario edita y no pasa nada).

## Las 3 capas

- **`lib/prompt-defaults.ts`** — el texto DEFAULT (fragmentos cortos) o, si es
  largo, viví el default en su archivo de origen y exportalo.
- **`lib/prompt-render.ts`** — el motor: `renderPrompt(key, fallbackTpl, vars)`
  devuelve el override guardado (o el default) con los `{{slot}}` reemplazados en
  UN SOLO PASE (anti-inyección). `contenidoNoConfiable(texto, etiqueta)` envuelve
  datos no confiables rompiendo `{{}}` internos.
- **`lib/prompt-registry.ts`** — la ÚNICA fuente de verdad. `REGISTRY: Group[]`
  lista cada prompt con `key`, `context`, `variables` (los slots), `default`,
  `source` ('persona'|'modo'|'fase'|'override').

## Pasos para agregar uno

1. Definí el default como `export const MI_PROMPT_TEMPLATE = '…{{slot}}…'` en tu
   lib (o en `prompt-defaults.ts`).
2. Importalo en `lib/prompt-registry.ts` (bloque de imports) y agregá una `Entry`
   a un `Group` del `REGISTRY` con `source:'override'`,
   `variables:[v('slot','descripción')]`, `default: MI_PROMPT_TEMPLATE`.
   (Patrón: grupo "Creador de campañas".)
3. En tu lib, resolvé el texto con
   `await renderPrompt('mi.prompt.key', MI_PROMPT_TEMPLATE, { slot })` y pasalo a
   `chatClaude(system, [{role:'user', content: user}], { feature:'mi-feature', … })`.
4. Para que salga con la voz/marca de MaKo, envolvé el system con
   `brandSystem(rendered)` (de `lib/campaign-structurer.ts`: persona + MAKO_NUCLEO
   + tu prompt). Para juntar contexto de negocio, imitá `buildCampaignBrief`
   (funnel + perfil + KPIs + método vía `searchKnowledge`/`metodologiaDeArea`).

## Reglas

- La `key` del registro y la key de `renderPrompt` deben coincidir EXACTAMENTE
  (el key drift es el bug clásico). Verificalo.
- Modelo por defecto `claude-opus-4-8` con `thinking:true` para tareas de
  análisis/escritura; `effort` según complejidad. Etiquetá `feature` para el
  desglose de gasto (`lib/anthropic.ts` registra tokens/costo).
- La edición se hace en `app/configuraciones/` contra `app/api/mako/config-prompts`
  (`GET` grupos, `POST {action:'save'|'restore'|'reset', key, text, ts}`).

Relacionado: `lib/anthropic.ts` (chatClaude), `lib/campaign-structurer.ts`
(brandSystem/buildCampaignBrief/parseJsonObject), `lib/mako-knowledge.ts`
(RAG por área), `lib/template-vars.ts` (aplicarVariables single/double brace).

### Claude

Ahora leo el generador de nutrición (voz + metodología), el registro de prompts y el mecanismo de historial del lead.


---

## Martín

`2026-07-31 15:02`

Base directory for this skill: C:\Users\marti\OneDrive\Escritorio\dashboard-marketing-main\dashboard-marketing\.claude\skills\nextjs16-conventions

# Convenciones Next.js 16 del repo

AGENTS.md: "This is NOT the Next.js you know" — APIs y convenciones difieren de tu
training. Ante la duda, leé `node_modules/next/dist/docs/01-app/...` antes de
escribir. Abajo, los patrones que YA usa el repo (imitalos).

## Route handlers (`app/api/**/route.ts`)

- `export const dynamic = 'force-dynamic';` casi siempre (no cachear).
- `export async function GET/POST/PATCH/DELETE(req: NextRequest)`.
- Respuesta SIEMPRE `Response.json({ ok, error?, ...datos }, { status })`. Nunca
  devolver datos crudos. Helper típico: `const msg = (e) => e instanceof Error ? e.message : String(e)`.
- Parseo del body con try/catch → 400 `{ok:false, error:'body inválido'}`.
- **Integraciones externas fallan SIN lanzar**: log + `return {ok:false, error}`;
  las excepciones son solo para validación de config. (Patrón chatwoot/meta/resend.)
- `maxDuration = 300` para rutas pesadas (crons, extracción).
- **maxDuration + llamadas HTTP bloqueantes**: poné timeout a los fetch externos
  (`AbortSignal.timeout(ms)`) para no colgar la función hasta el límite.

## Pages (`app/**/page.tsx`) — Server Components async

- Cada page de negocio es `async` con `export const dynamic='force-dynamic'` y su
  PRIMERA línea es el guard: `await requireRolWs([permitidos], opts?)` (de
  `lib/tab-access.ts`). `[]` = solo admin-cliente; `['setter']` = setter+admin.
- `requireRolWs` además gatea el onboarding salvo `{gateOnboarding:false}`.
  Páginas del whitelist de closer/setter usan `await guardOnboarding()` suelto.
- El componente cliente pesado va en un `XApp.tsx` aparte con `'use client'`; la
  page es el wrapper server que aplica el guard y renderiza `<XApp/>`.

## Gating de acciones outward-facing

Enviar emails/WhatsApp o escribir a Meta = acciones sensibles: además del gating
de la tab, chequeá el rol en el route (`getRolWsEfectivo() === 'admin'`) donde
corresponda. Middleware: rutas públicas (webhooks, unsubscribe, cron) van en
`PUBLICOS` de `middleware.ts` (si no, el gate de login las bloquea 401).

## No romper el estilo

Sin `<select>` nativo → usar `app/components/Dropdown.tsx`. Reuniones = R1/R2 en
la UI (nunca J1/J2). Tokens CSS de `app/globals.css` (--ink/--accent/--surface/…),
nunca colores hardcodeados salvo en emails (inline).

### Claude

Tengo todo el mapa. Reviso un último detalle — cómo se registran las features para el override de modelos en `/modelos-ia` y la firma de `chatClaude`:

### Claude

Ahora el trigger en el [webhook de Fathom](dashboard-marketing/app/api/webhooks/fathom/route.ts):

### Claude

Ahora la feature en el catálogo de modelos y la label de gasto de IA:

### Claude

Guardo la memoria del feature con lo no-obvio (estado de go-live y gates):

### Claude

Listo — sc18_2 implementado, verificado y pusheado a main (commit `7b69065`).

**Cómo funciona el flujo nuevo:** cuando el webhook de Fathom avisa que terminó una llamada de venta matcheada a un lead, la ruta responde 200 de inmediato y en background (`after()`, con `maxDuration 300`) corre [lib/post-llamada.ts](dashboard-marketing/lib/post-llamada.ts): ejecuta el Closing Analyst sobre la llamada (idempotente — reutiliza `analizarLlamadasDeLead`, así el análisis también queda en `/closing`), toma de ahí el resumen con los dolores, las objeciones (marcando cuáles quedaron abiertas) y el próximo paso, y con eso + la guía de voz del negocio + la metodología de mensajes redacta el follow-up. El resultado queda como **borrador** en `wa_borradores` con origen `post_llamada` — el setter lo ve en el panel de borradores de `/whatsapp` (con etiqueta "Post-llamada · MaKo") y lo envía con un clic. Nunca hay envío automático directo, y queda rastro en el historial del lead: "MaKo redactó el follow-up de la R1/R2…".

**Guardas para no crear borradores malos:** se salta si el lead no asistió (eso lo cubre la nutrición de no-show), si el lead no tiene teléfono, si ya existe un borrador post-llamada de las últimas 6 horas (reintentos de Svix), o si el análisis clasificó la llamada como entrega de servicio o quedó sin transcript. Cada skip loguea su motivo.

**Registro y configuración:** el prompt quedó editable en `/configuraciones` (grupo "Follow-up post-llamada (MaKo)", keys `postllamada.followup.system/.user`, siguiendo la skill add-editable-prompt), la feature `post-llamada` aparece en `/modelos-ia` (Sonnet por defecto, marcada PII) y en las etiquetas de gasto de IA.

**Verificación:** typecheck limpio en mis archivos, y probé en runtime contra el dev server: el webhook compila (GET 200) y `config-prompts` sirve el grupo nuevo con las dos keys y sus slots. No pude probar el flujo completo end-to-end porque requiere un webhook real de Fathom — esa primera llamada real en producción es la prueba pendiente. También quedó pendiente (como posible mejora, no lo pedía la tarea) un aviso al dueño del tipo "te dejé el follow-up en borradores". No toqué el estado de la tarea #18 en el board — eso lo marca Martín al revisar.

