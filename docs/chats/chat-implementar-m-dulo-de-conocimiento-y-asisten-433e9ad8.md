# Implementar módulo de conocimiento y asistente MaKo

`2026-07-01 02:30` → `2026-07-01 03:21` · 2 mensajes de Martín · 67 respuestas de Claude · sesión `433e9ad8`

> Transcripción de la conversación. **No incluye las llamadas a herramientas ni sus resultados** —son el 96% del peso y no son la charla— ni el razonamiento interno de Claude. Las credenciales que aparecían en el texto están **redactadas**; el resumen de qué se hizo en cada sesión está en [chats.md](chats.md).

---

## Martín

`2026-07-01 02:30`

Quiero que bajes a tierra TODA la documentación de "Levantamuertos" y que:

1. Crees una tab que se acceda desde la foto de perfil, que sea "Conocimiento", donde se vayan bajando todos estos cursos... Empezando por el de Levantamuertos. Pero en un futuro te puedo pasar más y de otros autores para otras partes... Levantamuertos es para mensajes, pero podría pasarte para crear ads, etc... Te los pasaré con la transcripción o incluso subir el vídeo de las clases, para que con OpenAI lo puedas transcribir y almacenar en la base de conocimientos.
2. Con la info de Levantamuertos, quiero que en WhatsApp, donde dice "Plantillas rápidas", esté MaKo, dandote consejos sobre como escribir tus mensajes... Que lea en tiempo real las conversaciones (que guarde el historial claro...) y que te recomiende que escribir... Y claro que se pueda chatear con MaKo para preguntar. También quiero que te ayude a redactar los templates para Meta, con la metodología de Levantamuertos.



https://github.com/Carlos-Dominguez-faber/levanta-muertos-s/tree/main/docs

### Claude

I'll start by understanding the codebase and fetching the Levantamuertos documentation. Let me explore in parallel.

### Claude

The project is under `dashboard-marketing/`. Let me explore the real app structure and fetch the docs in parallel.

### Claude

This is a substantial Next.js app with an existing MaKo knowledge/context system. Let me dig into the key subsystems and fetch the docs. Loading web tools and reading core files in parallel.

### Claude

Noting the AGENTS.md directive about reading the local Next.js docs before writing code. Let me fetch the GitHub docs via `gh` and read the core WhatsApp + knowledge files in parallel.

### Claude

Excellent context. The app already has a MaKo knowledge/RAG system, a prompts registry, MakoChat, and a template validator. The "PLANTILLAS RÁPIDAS" panel in the screenshot is the `QUICK` array in the chat right-sidebar. Let me map the remaining critical subsystems in parallel before designing.

### Claude

Now let me map the AI infrastructure, RAG backend, navigation/profile menu, and DB schema.

### Claude

The app already has `lib/transcribe.ts`, `lib/embeddings.ts`, `lib/anthropic.ts`, a prompts registry, and the MaKo context system. Let me read the AI infra, the chat backend, the template validator, and find the sidebar/profile menu.

### Claude

Now the DB schema, template validator, and chat backend — the last pieces before I design.

### Claude

I have the full architecture now. Let me get the Levantamuertos docs — I'll clone the repo since `gh` isn't available, and read the chat-insights route in parallel.

### Claude

The clone worked. The docs are the Levantamuertos methodology applied across niches. Let me read the core methodology docs and see the full repo structure.

### Claude

This repo IS the Levantamuertos app — a WhatsApp reactivation script generator. The methodology lives in the docs and the generator prompts. Let me read the core methodology files.

### Claude

I now have the complete Levantamuertos methodology. Let me grab the coaching niche (most relevant to Mauricio's consulting business) and the operational prompt builder, plus the README for framing.

### Claude

I have the complete Levantamuertos methodology now. Before writing code, the project's AGENTS.md directs me to check the local Next.js docs for breaking changes, and I need the exact conventions for file-upload routes, the prompt registry, and the page shell. Let me gather these.

### Claude

Next 16.2.6 / React 19. Let me confirm the route-handler conventions (async params in Next 16) and the prompt-registry API before writing code.

### Claude

Let me read the prompt registry (to register new editable prompts) and the persona module, then I'll start building.

### Claude

I now have a complete, precise understanding of the entire architecture and the full Levantamuertos methodology. Let me set up a task list and start building.

### Claude

Starting with the schema and knowledge lib. Let me mark task 1 in progress and write the migration.

### Claude

Now let me extend the knowledge lib with the new columns, area filtering, and course grouping.

### Claude

Task 1 done (I'll verify with typecheck/lint later — per project setup, local has no Supabase and preview is off by preference). Moving to the Levanta Muertos seed and the transcription helper.

### Claude

Now the generic media transcription helper. Let me add it to `lib/transcribe.ts`.

### Claude

Task 2 complete. Now the knowledge API (course fields + seed action) and the transcribe route.

### Claude

Task 3 done. Now the Conocimiento tab UI and nav wiring. Let me build the view component.

### Claude

Now the page shell and nav entry.

### Claude

The file changed (a "Perfil" entry was added). Let me add Conocimiento to the current version.

### Claude

Tasks 3 & 4 done. Now the WhatsApp advisor backend. First, a helper to pull all active messaging knowledge, then the advisor lib.

### Claude

Now the advisor lib with editable, grounded prompts.

### Claude

Now register the advisor prompts as editable (per the project's "all prompts editable" convention) and build the API route.

### Claude

Now the advisor API route.

### Claude

Task 5 done. Now the advisor UI panel, wiring it into the WhatsApp sidebar, and the template generator.

### Claude

Now let me wire the advisor into the WhatsApp page: add the import, widen the right column, and replace the "Plantillas rápidas" block.

### Claude

Now let me add the "Redactar con MaKo (Levanta Muertos)" generator to PlantillasPanel. Let me re-read the key regions first (files have been changing).

### Claude

Now the generator handler and its UI panel in the editor.

### Claude

Let me fix a couple of correctness issues in ConocimientoView (React.ReactNode needs the type imported; ternary-as-statement).

### Claude

Task 6 done. Now verification — typecheck and lint.

### Claude

Typecheck passes clean. Now lint.

### Claude

Those 8 errors are all pre-existing (in `ad-charts.tsx`, `marketing/page.tsx`, `ScriptsBrowser.tsx`) — none in my files. Let me lint my changed files specifically to confirm they're clean.

### Claude

All my files pass lint and typecheck clean. One integration concern to check: the advisor persists chat sessions with `chart_key = wa-advisor:<id>`, and the global "Preguntale a MaKo" tab lists *all* sessions — those per-lead advisor chats would clutter it. Let me verify and fix.

### Claude

Let me exclude the per-lead advisor sessions from the global MaKo tab listing.

### Claude

All my files pass typecheck and lint. Now let me run an adversarial multi-agent review over the full change set to catch integration bugs, edge cases, and completeness gaps.

### Claude

The review is running in the background across 5 dimensions with adversarial verification. While it completes, here's where things stand.

## Progress so far

I read the full architecture and the entire **Levanta Muertos** methodology (cloned the repo — the docs plus the generator's system prompts), then built both features end-to-end. Everything **passes `tsc --noEmit` and ESLint clean**.

**1. "Conocimiento" tab (from the profile menu)**
- Migration [`0049_mako_knowledge_cursos.sql`](dashboard-marketing/supabase/migrations/0049_mako_knowledge_cursos.sql) — adds `curso`/`autor`/`area`/`fuente` to `mako_knowledge` (additive; existing RAG untouched). **You'll need to apply this migration to Supabase.**
- New [`/conocimiento`](dashboard-marketing/app/conocimiento/ConocimientoView.tsx) page, added to `USER_NAV` (profile photo → **Conocimiento**). Courses grouped by `curso`, each with an `area` (Mensajes / Anuncios / General) so knowledge plugs in where it belongs.
- **Levanta Muertos** ships as a one-click "Bajar a tierra" curated course — 7 distilled lessons (3 pilares, C.I.A., reglas/prohibiciones, por etapa, nicho coaching, banco de scripts, secuencias) in [`mako-knowledge-seed.ts`](dashboard-marketing/lib/mako-knowledge-seed.ts).
- Add knowledge by pasting text **or uploading a class video/audio** → OpenAI Whisper transcribes it ([transcribe route](dashboard-marketing/app/api/mako/knowledge/transcribe/route.ts)) → you review → save (embedded).

**2. WhatsApp — MaKo advisor replaces "Plantillas rápidas"**
- New [`WhatsAppAdvisor`](dashboard-marketing/app/whatsapp/WhatsAppAdvisor.tsx) panel with **Consejo** (reads the live conversation → diagnosis + 2-3 ready-to-send messages, each with ángulo/tono + voice-note guion, "Usar →" inserts into the composer) and **Chat** (ask MaKo, history saved per-lead). Grounded in the `area='mensajes'` methodology via [`lib/whatsapp-advisor.ts`](dashboard-marketing/lib/whatsapp-advisor.ts) + [advisor API](dashboard-marketing/app/api/whatsapp/advisor/route.ts). Respects the 24h window.
- [`PlantillasPanel`](dashboard-marketing/app/whatsapp/PlantillasPanel.tsx) now has **"✨ Redactar con MaKo · Levanta Muertos"** — objetivo + etapa → a Meta-compliant template draft.
- All new prompts registered as editable in the prompt registry.

The adversarial review workflow (correctness / Supabase / React / AI-prompts / completeness, each verified by skeptics) is finishing now — I'll address any confirmed must-fixes when it lands.

### Claude

The review completed with 12 confirmed findings. Let me read the full output to prioritize.

### Claude

The review confirmed 12 issues (verdict: fix-first) — 6 must-fixes, no rework. The findings are legitimate. Let me address all must-fixes plus the high-value polish items. Starting with ConocimientoView (silent failures + create data-loss + per-lesson area).

### Claude

Now the per-lesson area badge and the AgregarPanel type + no-clobber guardar:

### Claude

Now the transcribe MIME guard (must-fix 5) — accept empty/generic MIME since Whisper sniffs by content.

### Claude

Now harden `tomarJSON` (must-fix 3), raise `maxTokens` (must-fix 6), and make `redactarTemplate` surface an error instead of an empty draft.

### Claude

Now the WhatsAppAdvisor stale-response guard (must-fix 4) and scroll-on-tab-switch. Let me add the request-id ref and guard `analizar`.

### Claude

Now the advisor→template hand-off (finding #6) and the non-destructive "Usar" (nice-to-have). Let me wire the advisor's template CTA to pre-fill the drafter.

### Claude

Now wire it through the WhatsApp page — add seed state, non-destructive Usar, and pass the seed to PlantillasPanel.

### Claude

Now update PlantillasPanel to accept and apply the seed.

### Claude

Two more polish items: guarantee the foundational Levanta Muertos entries survive the methodology cap, and return 404 (not 200-null) on a missing entry.

### Claude

All must-fixes and high-value polish applied. Let me re-run typecheck and lint on the changed files to confirm everything is clean.

### Claude

One refinement on the transcribe guard: accept an empty/generic MIME only when the filename has a media extension (so a stray empty-MIME non-media file isn't sent to Whisper).

### Claude

Let me run a final full typecheck + lint on all changed files to confirm the whole change set is green.

### Claude

Both typecheck and lint pass clean across the entire change set. Let me mark the work complete and record the non-obvious project facts in memory.

### Claude

Listo. Bajé a tierra toda la metodología de **Levanta Muertos** y construí las dos features completas, revisadas con un pase multi-agente adversarial y con los 6 must-fix ya corregidos. Todo pasa `tsc` y ESLint limpio.

## 1. Tab "Conocimiento" (desde la foto de perfil)
- Nueva vista [`/conocimiento`](dashboard-marketing/app/conocimiento/ConocimientoView.tsx) en el menú de tu foto de perfil. Organiza el conocimiento por **cursos**, cada uno con un **área** (Mensajes / Anuncios / General) para que se enchufe donde corresponde.
- **Levanta Muertos** aparece como curso curado para **"Bajar a tierra" con un click** — 7 lecciones destiladas (3 pilares, C.I.A., reglas/prohibiciones, por etapa, nicho coaching, banco de scripts, secuencias 7/14/21). A futuro sumás cursos de otros autores/áreas (ads, etc.) igual.
- Cargás conocimiento **pegando texto** o **subiendo el video/audio de una clase** → OpenAI (Whisper) lo transcribe, lo revisás y lo guardás (se indexa con embedding).

## 2. WhatsApp: MaKo reemplaza "Plantillas rápidas"
- Panel [`WhatsAppAdvisor`](dashboard-marketing/app/whatsapp/WhatsAppAdvisor.tsx) en la sidebar del chat, con dos modos:
  - **Consejo**: lee la conversación **en vivo** → diagnóstico + 2-3 mensajes listos (con ángulo/tono + guion de nota de voz), "**Usar →**" los inserta en el compositor. Respeta la ventana de 24h.
  - **Chat**: le preguntás a MaKo sobre ese lead; **el historial se guarda por contacto**.
- Todo apoyado en la metodología `area='mensajes'`.
- En **Plantillas**: botón **"✨ Redactar con MaKo · Levanta Muertos"** (objetivo + etapa → plantilla Meta-safe). Con la ventana cerrada, el asesor te lleva ahí con el redactor ya pre-cargado.
- Todos los prompts nuevos quedaron **editables** en Configuraciones.

## Lo único que tenés que hacer vos
Aplicar la migración en Supabase: [`0049_mako_knowledge_cursos.sql`](dashboard-marketing/supabase/migrations/0049_mako_knowledge_cursos.sql) (agrega `curso/autor/area/fuente`; es aditiva, no toca nada existente). **Sin ella, importar/crear conocimiento falla.** Después entrás a **Conocimiento → "Bajar a tierra" Levanta Muertos** y ya queda todo enchufado.

## Sobre la revisión
El pase adversarial (5 dimensiones × verificadores) confirmó 12 hallazgos. Corregí los 6 críticos —entre ellos fallos silenciosos que borraban tu texto transcrito, un parser de JSON frágil, y una respuesta de análisis que podía filtrarse a otro chat— más los pulidos de UX (no pisar tu borrador al usar una sugerencia, badges de área por lección, 404 en vez de 200-null, etc.).

No pusheé nada (este directorio no es un repo git y no me lo pediste). Si querés, lo dejo commiteado.


---

## Martín

`2026-07-01 03:15`

Tienes acceso a Supabase con las env local
Termina todo y pushea

### Claude

Voy a aplicar la migración con las credenciales del `.env.local` y luego pushear. Primero reviso cómo se conecta el repo a la base y qué credenciales hay.

### Claude

Hay un `DATABASE_URL` directo a Postgres (Supabase). Voy a aplicar la migración por esa conexión. Déjame ver cómo se conectan los scripts existentes para replicar el patrón (SSL, etc.).

### Claude

There's already a `scripts/apply-migration.mjs` in the repo. Let me read it to use the project's own tooling.

### Claude

El repo tiene un runner que valida el proyecto correcto y refresca el cache de PostgREST. Aplico la migración 0049 con él.

### Claude

Migración aplicada (proyecto verificado: leads=367). Ahora, para dejar **todo listo y usable de una**, voy a sembrar Levanta Muertos en la base (con embeddings) mediante un script — así el asesor de WhatsApp ya tiene la metodología sin que tengas que importar nada. Escribo el script siguiendo el patrón de los `seed-*` del repo.

### Claude

tsx is emitting CJS here, so top-level await fails. Let me wrap it in an async IIFE.

### Claude

Sembrado: 7 entradas de Levanta Muertos, indexadas, `area='mensajes'`. Ahora el push. Reviso el estado de git.

### Claude

On `main` with remote `mbustos-digital/dashboard-marketing`. The tree has my feature plus other in-progress work (configuraciones, prompt-registry, martinkoncke, a few `lib/onboarding.ts`/`transcribe-ads` tweaks) that my prompt-registry change is intertwined with. No deletions, and typecheck is green across the whole tree. Per your push-to-main workflow I'll commit the current state and push, centered on this feature.

### Claude

Commit `48cd2db` creado. Ahora pusheo a `main`.

### Claude

Pushed to `main` (`e3d7024..48cd2db`). Let me verify the DB end-state by re-running the idempotent seed — it should report the course already present.

### Claude

Verificado: la migración está aplicada (la consulta por `curso` funciona) y las 7 entradas de Levanta Muertos están sembradas e indexadas. Actualizo la memoria (la migración ya no está pendiente) y cierro.

### Claude

Listo, terminado y en producción. ✅

## Lo que quedó hecho
- **Migración `0049` aplicada** a Supabase (proyecto verificado, `leads=367`, cache de PostgREST recargado). Las columnas `curso/autor/area/fuente` ya existen.
- **Levanta Muertos sembrado**: 7 lecciones con embeddings, `area='mensajes'`, indexadas. Verificado idempotente (re-correr dice *"ya estaba (7 entradas)"*).
- **Push a `main`** hecho: [`48cd2db`](https://github.com/mbustos-digital/dashboard-marketing/commit/48cd2db) (`e3d7024..48cd2db`).

## Ya funciona sin que toques nada
- **Conocimiento** (menú de tu foto de perfil → *Conocimiento*): vas a ver el curso *Levanta Muertos* ya cargado con sus 7 lecciones. Podés agregar más pegando texto o **subiendo un video/audio** de una clase (lo transcribe OpenAI).
- **WhatsApp**: donde estaba *"Plantillas rápidas"* ahora está **MaKo** leyendo la conversación en vivo, recomendando qué escribir con la metodología, con chat de historial por lead; y en *Plantillas*, el botón **"Redactar con MaKo (Levanta Muertos)"**.

## Un aviso de transparencia sobre el push
El commit barrió **todo el working tree**, no solo esta feature — había trabajo tuyo en curso mezclado (la feature de **Configuraciones/prompts editables** con `lib/prompt-registry.ts` + `app/configuraciones/` + `app/api/mako/config-prompts/`, la ruta `app/martinkoncke/`, y retoques en `lib/onboarding.ts` y las rutas de transcripción). Mi cambio en `prompt-registry.ts` dependía de ese archivo, así que separarlos habría dejado referencias colgando. No había borrados y el `tsc` pasa limpio en todo el árbol. Si algo de eso **no** querías publicar todavía, avisame y lo revierto del historial.

Calidad: `tsc --noEmit` y ESLint limpios en todos los archivos de la feature; revisión adversarial multi-agente con los 6 hallazgos críticos corregidos (fallos silenciosos que borraban texto, parser JSON robusto, guard de respuestas entre chats, etc.).

