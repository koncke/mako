---
name: verify-prompt-registry-sync
description: >
  Auditar que los prompts de MaKo estén bien cableados entre lib/prompt-registry.ts,
  los defaults y los call-sites — caza las fallas silenciosas que el compilador NO
  ve (keys muertas, slots que no coinciden, defaults a la deriva). Usar tras editar
  prompts/templates o antes de mergear. Complemento de `add-editable-prompt`.
---

# Verificar el sincronismo del registro de prompts

`add-editable-prompt` enseña a AGREGAR uno bien; esta skill REVISA que lo existente
no haya driftado. Nada de esto lo chequea TypeScript: un typo deja la edición del
usuario muda y no falla la compilación.

## Qué buscar

1. **Key drift (el bug clásico).** Para cada `Entry.key` del `REGISTRY`
   (`lib/prompt-registry.ts`), tiene que existir un call-site que resuelva ESA misma
   key con `getPromptText('key', DEFAULT)` o `renderPrompt('key', DEFAULT, vars)`.
   - Key en el registro sin call-site → **entrada muerta**: el usuario edita en
     `/configuraciones` y no pasa nada.
   - Call-site con una key que NO está en el `REGISTRY` → **prompt no listado**: no es
     editable (viola la regla "todo prompt de MaKo es editable").
2. **Slots que no coinciden.** El set de `{{slot}}` del template, el `variables:[v(...)]`
   de la Entry y las keys del objeto que se le pasa a `renderPrompt(...)` deben ser
   IDÉNTICOS.
   - Slot en el template no declarado en `variables` → el usuario puede borrarlo desde
     la UI y silenciosamente cortar datos de runtime.
   - `variable` declarada que no está en el template, o key de `renderPrompt` distinta
     al slot → dato que nunca se inyecta.
3. **Default a la deriva.** El `default:` de la Entry y el `DEFAULT` que el call-site
   pasa como fallback a `getPromptText/renderPrompt` deben ser la MISMA constante. Si
   divergen, el "reset" de la UI restaura un texto distinto al que corre por defecto.
4. **`contenidoNoConfiable` faltante.** En prompts `source:'override'` con datos
   externos (transcripts, mensajes del lead, documentos subidos, campos del CRM), el
   call-site debe envolver esos strings con `contenidoNoConfiable(x, 'etiqueta')`
   (`lib/prompt-render.ts`) — si no, es una vía de inyección de prompt.

## Cómo reportar

Una tabla por key: `registro.key ↔ default const ↔ call-site ↔ set de slots`, marcando
la fila donde algo no cuadra y el fix mínimo (renombrar la key, agregar/quitar la
`variable`, unificar el default, envolver el input). Es read-only: NO cambies prompts
sin confirmar, un texto es load-bearing para el JSON de salida de varios analistas.

## Barrido de arranque

- Listá las `key:` del `REGISTRY` y grepeá cada una en `lib/` y `app/api/` para hallar
  su call-site (o su ausencia).
- Grep de `renderPrompt(` / `getPromptText(` → verificá que su primer argumento exista
  como Entry.
- Por cada template `*_TEMPLATE`, extraé los `{{...}}` y compará con la Entry.

Relacionado: `lib/prompt-registry.ts` (REGISTRY, source routing),
`lib/prompt-render.ts` (renderPrompt/getPromptText/contenidoNoConfiable),
`lib/prompt-defaults.ts`, skill `add-editable-prompt`.
