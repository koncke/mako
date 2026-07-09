---
name: nextjs16-conventions
description: >
  Convenciones de esta app Next.js 16 (App Router) — route handlers, page
  server-components, gating por rol, patrón de error. Usar SIEMPRE antes de crear
  o editar un route.ts bajo app/api o un page.tsx. AGENTS.md avisa que esta
  versión de Next NO es la que conocés: verificá contra node_modules/next/dist/docs.
---

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
