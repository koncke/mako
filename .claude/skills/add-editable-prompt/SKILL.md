---
name: add-editable-prompt
description: >
  Cómo agregar un prompt de IA (MaKo) que quede EDITABLE desde /configuraciones,
  con variables {{slot}}. Usar SIEMPRE que escribas un system/user prompt nuevo
  para chatClaude — para que no quede hardcodeado y mudo a la edición del usuario.
---

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
