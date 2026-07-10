---
name: scaffold-mako-writer
description: >
  Armar un "writer/generator" nuevo de MaKo (toma un pedido + brief del negocio →
  Claude devuelve copy/estructura como JSON, con historial opcional pero sin sync
  por-entidad). Usar al construir o destrabar un stub (ads/vsl/landing/dm-writer).
  Copia el patrón de campaign-structurer.ts / whatsapp-advisor.ts.
---

# Scaffold de un writer de MaKo

Un writer NO persiste una fila por entidad ni corre un sync batcheado como el
analyst: genera a pedido. Plantilla de oro: `lib/campaign-structurer.ts`.

## Las piezas

1. **`lib/<feature>.ts`** — el generador:
   - `import 'server-only'`; `chatClaude` (opus-4-8 + thinking + `feature` tag).
   - **Compositor de brief**: `build<Feature>Brief(prompt)` modelado en
     `buildCampaignBrief` — junta funnel + perfil + KPIs + ganadores + método
     (`searchKnowledge`/`metodologiaDeArea`), cada fuente degradando a `'—'` si falta.
   - **`brandSystem(rendered)`** (de `campaign-structurer.ts`): envuelve el system con
     `[persona, MAKO_NUCLEO, rendered]` para que salga con la voz de MaKo.
   - Templates `<FEATURE>_SUGGEST_SYSTEM/_USER` y `<FEATURE>_ADJUST_SYSTEM/_USER`, con
     un `{{jsonShape}}` que define la forma EXACTA del JSON + reglas de idioma/copy.
   - `parseJsonObject(text)` + `parse<Feature>Spec(text, fallback)` que coacciona a un
     spec tipado con defaults sanos.
   - Función `generar*()` **PURA** (envelope `{ok:true,spec}|{ok:false,error}`).
2. **Ruta** `app/api/<feature>/route.ts` (→ `nextjs16-conventions`): devuelve el JSON;
   opcionalmente `saveDraft()` a una tabla de historial (+ su migración → skill
   `author-numbered-migration`, con `workspace_id` en `TENANT_TABLES`).
3. **`lib/prompt-registry.ts`** (→ `add-editable-prompt`): registrá los 4 templates con
   keys `<feature>.suggest.system` etc., conservando los `{{slots}}` (`{{prompt}}`,
   `{{contexto}}`, `{{jsonShape}}`, `{{specActual}}`, `{{instruccion}}`).
4. **`app/<feature>/page.tsx`**: `requireRolWs([...])` + `<XApp/>`; y flip del
   `comingSoon` en `app/_components/nav.ts`.

## Invariantes

Mismos que el analyst: prompts editables (registry, sin key drift), anti-inyección
(`contenidoNoConfiable` en el pedido del usuario y en datos del negocio),
opus-4-8 + `feature` tag, generar puro con envelope. Multi-tenant si guardás
borradores (`getTenantDb`). El `{{jsonShape}}` es load-bearing: la pantalla de
revisión lee ese esquema — no lo cambies sin actualizar el `parse<Feature>Spec`.

Plantillas: `lib/campaign-structurer.ts` (brandSystem/buildCampaignBrief/
parseJsonObject/parseCampaignSpec/objetivosTexto), `lib/whatsapp-advisor.ts`. Para un
analista que persiste y sincroniza → `scaffold-mako-analyst`.
