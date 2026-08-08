# Registrar prompt editable del Archivero

`2026-07-26 17:41` → `2026-07-26 17:44` · 1 mensajes de Martín · 9 respuestas de Claude · sesión `1ff6b1b4`

> Transcripción de la conversación. **No incluye las llamadas a herramientas ni sus resultados** —son el 96% del peso y no son la charla— ni el razonamiento interno de Claude. Las credenciales que aparecían en el texto están **redactadas**; el resumen de qué se hizo en cada sesión está en [chats.md](chats.md).

---

## Martín

`2026-07-26 17:41`

En el repo dashboard-marketing, el prompt de extracción de El Archivero (`archivero.extract.system`, definido como `ARCHIVERO_EXTRACT_TEMPLATE` en lib/onboarding.ts y usado vía renderPrompt en la función extraerDeArchivo) NO está registrado en el sistema de prompts editables. Registrarlo siguiendo la skill add-editable-prompt (lib/prompt-registry.ts + prompt-defaults) para que se pueda editar desde /configuraciones, con su/s {{slot}} (usa {{lista}}). Verificar con la skill verify-prompt-registry-sync. Mismo criterio que el prompt hermano `onboarding.extract.system`.

### Claude

I'll start by exploring the relevant files and the skills referenced in the task.

### Claude

The skill instructions are clear. Now let me look at the actual code — the target prompt, its sibling, and the registry.

### Claude

Now let me look at how the sibling `onboarding.extract.system` is registered in the registry.

### Claude

I have the pattern. Let me check the `v` helper and the imports block to place things correctly.

### Claude

I have everything I need. The `archivero.extract.system` prompt is a sibling of `onboarding.extract.system` — same group, same `{{lista}}` slot, same JSON-extraction nature. Let me make the two edits: add the import, then add the registry entry.

### Claude

Now the registry entry, right after the `onboarding.extract.system` block:

### Claude

Both edits are in. Now let me run the `verify-prompt-registry-sync` audit as the task requires. First the key-drift and slot checks via grep.

### Claude

All four `verify-prompt-registry-sync` checks pass:

| Check | Result |
|---|---|
| **Key drift** | `archivero.extract.system` exists in exactly 2 places: registry entry ([prompt-registry.ts:490](dashboard-marketing/lib/prompt-registry.ts:490)) ↔ call-site `renderPrompt(...)` ([onboarding.ts:117](dashboard-marketing/lib/onboarding.ts:117)). No dead entry, no unlisted prompt. ✓ |
| **Slots match** | Template has only `{{lista}}` → `variables:[v('lista',…)]` → `renderPrompt(…, { lista })`. Identical set. ✓ |
| **Default drift** | Registry `default: ARCHIVERO_EXTRACT_TEMPLATE` = same constant the call-site passes as fallback. ✓ |
| **`contenidoNoConfiable`** | Untrusted doc text is the *user* message (`texto.slice(...)`), not injected into a slot; `{{lista}}` comes from internal `fields`. Same handling as the sibling `onboarding.extract.system`. ✓ |

Let me confirm it compiles with the repo's typecheck (runs locally, cheap):

### Claude

Typecheck passes (exit 0). The change is complete.

## Resumen

Registré el prompt `archivero.extract.system` en el sistema de prompts editables, siguiendo la skill `add-editable-prompt` y espejando exactamente a su hermano `onboarding.extract.system`. Dos ediciones en [lib/prompt-registry.ts](dashboard-marketing/lib/prompt-registry.ts):

1. **Import** — agregué `ARCHIVERO_EXTRACT_TEMPLATE` al import desde `./onboarding` (el default vive en su archivo de origen, como recomienda la skill para templates largos).
2. **Entry** — nueva `Entry` en el grupo *"Extracción de documentos (onboarding y contratos)"*, justo debajo de `onboarding.extract.system`:
   - `key: 'archivero.extract.system'`, `source: 'override'`
   - `variables: [v('lista', 'los campos pedidos (clave: qué pide)')]` — su único `{{slot}}`
   - `default: ARCHIVERO_EXTRACT_TEMPLATE` (misma constante que el call-site pasa como fallback)
   - `dynamic: true`, `scope: 'static-only'`, `sensitive: true` (idéntico al hermano)
   - `context:` explica que lee un doc por vez y devuelve JSON con `razonamiento`.

Ahora es editable desde `/configuraciones`. Antes quedaba mudo a la edición (key drift): el usuario no lo veía y no había nada que tocar.

**Verificación (`verify-prompt-registry-sync`):** los 4 chequeos pasan — sin key drift (registro ↔ call-site coinciden), slots idénticos en template/`variables`/`renderPrompt` (`{{lista}}`), default sin deriva, y `contenidoNoConfiable` no aplica (el texto no confiable del documento va como mensaje *user*, no inyectado en un slot — igual que el hermano). El `npm run typecheck` cierra en exit 0.

Nota: no lo pusheo — es una decisión tuya cuándo agrupar y pushear (cada push cuesta ~US$0.09 en build).

