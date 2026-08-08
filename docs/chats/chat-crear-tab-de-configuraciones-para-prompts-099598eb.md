# Crear tab de Configuraciones para prompts

`2026-06-29 11:58` → `2026-06-29 13:35` · 2 mensajes de Martín · 45 respuestas de Claude · sesión `099598eb`

> Transcripción de la conversación. **No incluye las llamadas a herramientas ni sus resultados** —son el 96% del peso y no son la charla— ni el razonamiento interno de Claude. Las credenciales que aparecían en el texto están **redactadas**; el resumen de qué se hizo en cada sesión está en [chats.md](chats.md).

---

## Martín

`2026-06-29 11:58`

Quiero que crees una nueva tab, que se acceda haciendo click en el user, cuando salta el desplegable de onboarding y eso...

Esta tab se debe llamar "Configuraciones" y dentro se debe poder configurar MaKo...
Por ahora, quiero que se pueda configurar todos los prompts impuestos en codigo, todos todos. Claro que tiene que haber un contexto para entender a que se refiere ese prompt.

### Claude

Voy a empezar explorando el codebase para entender la estructura, dónde está el desplegable del usuario/onboarding, y dónde están todos los prompts hardcodeados. Déjame mirar primero la estructura general.

### Claude

Ahora veo el dropdown del usuario. Veamos el `nav.ts` (que define `USER_NAV`) y los archivos de prompts/settings existentes.

### Claude

Veamos la API de prompts existente y la página `/contexto` para entender el patrón UI/API actual.

### Claude

Déjame entender cómo se hacen las llamadas al LLM y hacer un primer barrido de dónde viven los prompts.

### Claude

Esto es una feature grande con ultracode activo. Voy a lanzar un workflow de descubrimiento exhaustivo en paralelo que inventaríe **todos** los prompts hardcodeados por área de feature, y luego los consolide. Eso me da el mapa completo antes de diseñar la tab.

### Claude

Tengo el terreno claro. Lanzo el workflow de descubrimiento exhaustivo — un finder por área de feature, cada uno lee sus archivos y devuelve el inventario estructurado de prompts; luego un consolidador los unifica.

### Claude

El workflow corre en background. Mientras tanto, voy a leer un par de archivos clave para entender cómo se ensamblan los prompts en runtime (esto me sirve para el refactor sin importar el inventario).

### Claude

El workflow está corriendo. Tengo claro el patrón de la app (layout con Sidebar + cada página aporta su `<main>`, `app_settings` como store key/value, y el patrón de prompts editables ya existente en `lib/mako-prompts.ts`). Espero el inventario completo antes de diseñar el registro central.

### Claude

El workflow encontró **26 prompts** en todo el codebase. Tengo el final del blueprint pero me faltan los grupos del medio. Voy a leer el archivo completo de salida para tener el blueprint íntegro.

### Claude

Ahora tengo el blueprint completo. Leo la sección consolidada (grupos y prompts) para tener todos los detalles.

### Claude

Tengo el inventario completo: **26 prompts** en 10 grupos. De esos, 11 ya son editables hoy (persona, 5 fases, 5 modos vía `/contexto`); los otros ~15 están hardcodeados en código (closing, script-analyst, transcripción, onboarding, contratos, validador de plantillas, chat de gráficos, reglas de Meta).

Antes de meterme en el refactor (toca muchos archivos core de IA), quiero confirmar dos decisiones de alcance que cambian bastante lo que construyo:

### Claude

Perfecto: **todo en un lugar (26 prompts)** y **editables con advertencia**. Marco el capítulo y leo los archivos fuente que voy a refactorizar.

### Claude

Tengo todo lo que necesito. Verifico cómo se llama a `transcribeAd`/`structureTranscript` desde rutas server y scripts, para no romper la pureza de `transcribe.ts`.

### Claude

Tengo todo el código fuente mapeado. Ahora construyo. Arranco por el motor de resolución (store de overrides + render de placeholders), que es la base de todo.

### Claude

Ahora un módulo liviano con los defaults de los fragmentos pequeños (chat de gráficos, contrato, fragmentos de contexto), que comparten el registro y los call sites.

### Claude

Ahora refactorizo los call sites. Empiezo por los archivos de MaKo: agrego `resetPrompt` al store legacy de persona/modos.

### Claude

Refactorizo `mako-context.ts` (núcleo, reglas de Meta, fragmentos de contexto editables):

### Claude

Refactorizo la ruta `chart-insights` (3 prompts del chat de gráficos):

### Claude

Ahora `closing.ts`. Veo los imports del tope para engancharlos.

### Claude

Ahora convierto `buildUserPrompt` a template con slots y lo hago async, más el system editable en `analyzeMeeting`:

### Claude

Ahora `script-analyst.ts` (4 prompts). Veo los imports del tope.

### Claude

Ahora `buildUserPrompt` de script-analyst (template con slots, async):

### Claude

Ahora el call site `analyzeTranscript` (await en ambos builders):

### Claude

Ahora los dos prompts de valoración de script-analyst:

### Claude

Ahora `template-validator.ts` (system + reglas de Meta + rúbrica editables):

### Claude

Ahora `onboarding.ts` (extractor de campos):

### Claude

Ahora la ruta `extract-contract`:

### Claude

Ahora `transcribe.ts` — debe seguir sin `server-only` (lo usan scripts), así que exporto los textos base y acepto overrides por parámetro; las rutas los resuelven y los pasan.

### Claude

Ahora `transcribeAd` acepta los overrides y los reparte:

### Claude

Ahora las dos rutas que llaman a `transcribeAd` resuelven y pasan los overrides. Primero `regenerate-transcript`:

### Claude

Ahora el cron `transcribe-ads`. Lo leo para integrarlo:

### Claude

Todos los call sites están refactorizados con sus keys. Ahora construyo el **registro central** que define los 33 prompts (metadata + contexto + defaults) y resuelve/guarda según la fuente de cada uno.

### Claude

Ahora la API `/api/mako/config-prompts`:

### Claude

Ahora la página `/configuraciones` (client component), reutilizando el estilo de `ContextoTabs`. Primero el componente:

### Claude

Ahora agrego "Configuraciones" al menú del usuario (`USER_NAV`):

### Claude

La feature está cableada de punta a punta. Verifico con typecheck antes de seguir, y reviso que no queden otros llamadores de los builders que cambié a async.

### Claude

Todos los llamadores están actualizados (el `.mjs` tiene su propia copia, no importa de lib). Corro el typecheck:

### Claude

Typecheck limpio. Corro el linter sobre los archivos nuevos/tocados:

### Claude

Dos warnings menores. Saco el import sin usar en `script-analyst.ts` y silencio el hook deliberado:

### Claude

Ahora una build de producción completa para validar límites server/client y `server-only`:

### Claude

Build de producción **exitosa** — `/configuraciones` aparece como ruta dinámica y todo compila (typecheck y lint limpios). Guardo una memoria sobre la arquitectura nueva y luego te resumo.

### Claude

Listo. Construí la tab **Configuraciones** completa y la dejé funcionando de punta a punta.

## Qué hice

**La tab** vive en el menú del usuario (el desplegable donde están "Contexto de MaKo" y "Onboarding"). Agregué "Configuraciones" en [nav.ts](dashboard-marketing/app/_components/nav.ts) → abre [`/configuraciones`](dashboard-marketing/app/configuraciones/Configuraciones.tsx).

**Qué se puede configurar:** los **33 prompts** de IA, agrupados en 10 secciones (Persona, Núcleo, Fases, Modos, Chat de gráficos, Reglas de Meta, Validador de WhatsApp, Closing Analyst, Script Analyst, Transcripción, Extracción de documentos). Cada prompt trae:
- **Su contexto** (qué hace, cuándo corre, qué cuidar si lo editás).
- **Las variables `{{slot}}`** disponibles si es dinámico (clic para insertarlas; con aviso de "no las borres").
- **Editor + Guardar + Historial** (hasta 30 versiones) + **Restaurar default**.
- **Advertencia** en los delicados (los que definen un esquema JSON o son barandas), como pediste: editables, pero con cartel.
- Buscador arriba para filtrar entre los 33.

## Cómo funciona por dentro

- **`lib/prompt-registry.ts`** es la única fuente de verdad: lista cada prompt con su default y rutea según su origen.
- **Persona, fases y modos** leen/escriben el **mismo store** que ya usa `/contexto`, así que no se duplican ni se desincronizan — quedan en un solo lugar pero compatibles con la página vieja.
- **Los ~22 prompts antes hardcodeados** (closing, script-analyst, validador, transcripción, onboarding, contratos, chat de gráficos, reglas de Meta) ahora se resuelven con `getPromptText(key, default)` / `renderPrompt(key, tpl, vars)` desde [`lib/prompt-render.ts`](dashboard-marketing/lib/prompt-render.ts) (override en `app_settings`, key `mako.prompt-overrides`).
- Los dinámicos usan placeholders `{{...}}` que se reemplazan en runtime; el armado de los datos queda del lado seguro (código), no se rompe aunque edites el texto. Respeta los `{{1}}`/`{{nombre}}` literales de las plantillas de WhatsApp.
- API nueva: [`/api/mako/config-prompts`](dashboard-marketing/app/api/mako/config-prompts/route.ts).

**Clave:** si no tocás nada, MaKo se comporta **idéntico a hoy** — cada default es el texto original exacto.

## Verificación

`npm run typecheck` ✅ · `eslint` ✅ (0 errores) · `npm run build` ✅ (`/configuraciones` compila como ruta dinámica). No levanté el preview (sé que preferís que no, demora). Si querés que lo levante para verlo en vivo, decime.

## Una cosa menor

En la página vieja `/contexto`, el "Núcleo fijo" todavía se muestra como **"no editable"** — pero ahora sí lo es desde Configuraciones. Es solo un cartel desactualizado en la otra página, no afecta el funcionamiento. ¿Lo dejo así, o querés que limpie `/contexto` (o que lo deje solo apuntando a Configuraciones)?


---

## Martín

`2026-06-29 13:32`

¿Seguro que esos son todos los prompts actuales? No veo que en ningun momento hables del metodo SPIN o en general veo que son muy simples los prompts. Solo confirmame si esos son los prompts actuales tal cual

Y si, si lo son. ¿De donde obtiene la data actualmente MaKo para darme respuestas? Como es el flujo hoy en día?

### Claude

Buena observación — déjame confirmarlo con el código en la mano, sin adornos. Reviso dos cosas: (1) que el texto editable sea el prompt **literal** del código (incluido SPIN), y (2) todos los puntos donde se llama a un LLM, para asegurarme de que no falte ninguno. Y de paso miro de dónde sale la data.

### Claude

Confirmado el panorama de llamadas a LLM. Ahora miro cómo llega la data del gráfico al chat y cómo funciona el RAG, para explicarte el flujo con precisión.

### Claude

Revisé todo el código. Te confirmo las dos cosas:

## 1) Sí, son los prompts actuales tal cual — y SPIN está

Ojo con una distinción clave: lo que viste "simple" es el **texto de contexto** (la descripción gris que escribí yo para explicar cada prompt). El **prompt real** es lo que está dentro del *textarea* editable, y ese es el texto **literal del código, importado directo de la constante** — no lo reescribí ni lo simplifiqué.

El de Closing (`closing.analyze.system`) es justamente el que tiene SPIN. El default que cargás en la tab es, palabra por palabra, lo que está en [closing.ts:214](dashboard-marketing/lib/closing.ts:214). Incluye esto, textual:

```
Puntuás (0-10):
SPIN (g="spin"): "Situación", "Problema", "Implicación", "Necesidad / beneficio".
Ejecución (g="exec"): "Presentación de la propuesta", "Manejo de objeciones", "CTA / siguientes pasos".
En R1 puede no haber propuesta formal: puntuá esa dimensión por cómo encaminó hacia la R2.
```

…más toda la clasificación (Venta R1/R2 vs Entrega de servicio) y el esquema JSON completo. O sea: SPIN ya estaba en el código y está en la tab; el textarea de ese prompt tiene ~45 líneas, no la descripción cortita.

**Sobre "¿son TODOS?":** sí. Rastreé cada llamada a un LLM del app (no de los scripts sueltos). Son exactamente estas:
- **Claude:** chat de gráficos (3), Closing (system+user), Script Analyst (análisis + valoración), Validador de plantillas.
- **OpenAI:** transcripción (Whisper + estructurar + visión), extractor de onboarding, extractor de contrato.
- Lo único que NO toqué porque **no tiene "prompt"**: `embeddings.ts` (convierte texto en vectores para el buscador de metodología — no hay instrucción que editar).

Detalle honesto: hay scripts `.mjs` (backfill de closing, etc.) que tienen **su propia copia** de algunos prompts. Son herramientas de carga puntual, no corren desde la UI, y no están enchufadas al registro. Si querés también los unifico, pero hoy no afectan lo que MaKo hace en vivo.

## 2) De dónde saca la data MaKo hoy

Hay **dos flujos distintos**, y conviene no mezclarlos:

**A) El chat de gráficos (el botón ✨ MaKo / "Preguntale a MaKo")**

Cuando abrís el chat, [`buildSystemPrompt`](dashboard-marketing/lib/mako-context.ts:38) arma el system prompt pegando, en este orden:

1. **Persona** (la voz) + **Núcleo** (reglas duras).
2. **Perfil del negocio** → las respuestas de tu Onboarding (`perfilNegocioTexto`).
3. **Instrucción de la sección** (la "fase" según qué gráfico estás mirando).
4. **Metodología (RAG):** busca en tu base de Conocimiento las **4 entradas más parecidas** a tu pregunta (por embeddings + similitud coseno) y las pega.
5. **Los datos del gráfico**: un string que **arma el frontend** con los números de ESE gráfico (ej. `ctxFunnel`, `ctxAd`) y se manda a `/api/chart-insights`, recortado a 2000 caracteres.
6. (Solo en "whatsapp-secuencias": reglas de Meta + el estado real de tus secuencias/plantillas.)
7. + el historial del chat + tu mensaje → todo eso va a Claude Opus con razonamiento extendido.

**Límite importante (honesto):** MaKo **no consulta la base de datos por su cuenta** ni tiene "tool use". Solo ve lo que le pasaste: los números del gráfico abierto + tu perfil + la metodología recuperada + lo que escribís. No puede pedir más datos ni cruzar tablas en vivo. Por eso, si el gráfico no incluye un dato, MaKo no lo tiene. (Esto coincide con tu roadmap: "tool-use core" sigue pendiente.)

**B) Closing Analyst y Script Analyst (no son el chat)**

Corren del lado del servidor y **arman su propio prompt con datos crudos**, sin pasar por el chat:
- **Closing:** transcript + resumen + action items de Fathom, + el match con el lead del CRM (estado, fechas) → Claude → JSON.
- **Script Analyst:** el transcript del anuncio (de `ad_transcripts`) + el perfil real de tu cuenta (métricas de Meta agregadas por anuncio) → Claude → JSON.
- **Validador / transcripción / onboarding / contratos:** cada uno arma su input puntual (el borrador, el video/imagen, el documento) y lo manda al modelo.

En resumen: hoy MaKo es **"contexto que vos/la app le servís"**, no un agente que sale a buscar datos. Lo que la tab Configuraciones te da es control total sobre **las instrucciones** de los 33 puntos donde interviene un modelo; la **data** sigue viniendo de los flujos de arriba.

¿Querés que te muestre el texto completo de algún prompt puntual (Closing, Script Analyst, Validador) para que lo veas tal cual quedó editable, o que avancemos con darle a MaKo acceso real a datos (tool use)?

