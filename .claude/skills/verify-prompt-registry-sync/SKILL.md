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

## El barrido ya lo hace una guarda: NO lo repitas a mano (6/11/2026)

`scripts/prompts-registro-sincronizado.mjs` corre en cada push (`guardas-push.sh`),
EJECUTA el registro y cubre los modos **1 y 2** de arriba sobre las 173 entradas:
key huérfana, Entry `override` muerta, el call-site que pasa una clave que el template no
tiene, la `variable` declarada que no existe, el slot vivo sin declarar, una `storeKey`
que `MODOS` no tiene, y la key que no se puede seguir hasta un literal. Arrancá por:

    node --import tsx scripts/prompts-registro-sincronizado.mjs --listar

⚠️ **Y no grepees cada key en `lib/` y `app/api/` como decía esta skill hasta el 6/11**:
ese barrido daba ~45 falsos positivos (muchas keys llegan por indirección en tabla,
`PROMPTS_X.campo.key`) y además juzgaba mal las 167 entradas que NO son `source:
'override'`, donde la key del registro no es el identificador de lectura — ésas resuelven
por `storeKey`. El porqué, en `docs/hallazgos-ia.md` → «La guarda del registro de prompts».

## Lo que sigue siendo tuyo (la guarda NO lo mide)

- **Modo 3, default a la deriva**: que el `default:` de la Entry y el fallback del
  call-site sean la MISMA constante. La guarda tiene el TEXTO del default, no el nombre de
  la constante del call-site, así que no los puede cruzar; hoy lo fija a mano el test de
  cada feature (el molde: `tests/offer-ia-cableado.test.ts`).
- **Modo 4, `contenidoNoConfiable` faltante**: es un juicio sobre qué dato es externo.
- **Y el `{{slot}}` que nadie llena**: la guarda avisa y no bloquea, porque `{{...}}` tiene
  dos dueños y los placeholders de lead y de WhatsApp viajan literales a propósito. Decidir
  cuál de los dos es cada uno te toca a vos.

Relacionado: `lib/prompt-registry.ts` (REGISTRY, source routing),
`lib/prompt-render.ts` (renderPrompt/getPromptText/contenidoNoConfiable),
`lib/prompt-defaults.ts`, skill `add-editable-prompt`.
