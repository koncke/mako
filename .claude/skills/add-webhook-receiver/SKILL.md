---
name: add-webhook-receiver
description: >
  Crear un receptor de webhook entrante (app/api/webhooks/<provider>/route.ts) en
  este repo, con verificación de firma fail-closed y resolución explícita de
  workspace. Usar al recibir eventos de un proveedor (Meta/Chatwoot/Fathom/
  Calendly/Resend/Evolution). Evita el webhook que mete todos los leads al dueño.
---

# Agregar un receptor de webhook

Un webhook entra SIN sesión de usuario. Dos riesgos: firma no verificada y workspace
mal resuelto (leak). Ambos se cierran acá.

## Esqueleto (`app/api/webhooks/<provider>/route.ts`)

```ts
import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Healthcheck (y, si el proveedor lo pide, el handshake de challenge).
  return Response.json({ ok: true, endpoint: '<provider> webhook' });
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();
  const rawBody = await req.text();                 // RAW antes de parsear (para el HMAC)
  if (!verifySig(rawBody, req.headers.get('x-…-signature'))) {
    return Response.json({ ok: false, error: 'signature' }, { status: 401 });
  }
  let body; try { body = JSON.parse(rawBody); }
  catch { return Response.json({ ok: false, error: 'bad_json' }, { status: 400 }); }

  // … resolver workspace + procesar …
  console.log(`[webhook:<provider>] ok ms=${Date.now() - t0}`);
  return Response.json({ ok: true });               // evento no reconocido → { ok:true, ignored:true }
}
```

## Verificación de firma — SIEMPRE fail-closed

- Sin secret configurado → **rechazá** (`if (!secret) return false`), nunca
  `if (secret && ...)`.
- Comparación con `crypto.timingSafeEqual` y **guardá el largo** antes
  (`if (a.length !== b.length) return false`).
- Esquemas según proveedor (mirá el existente y copialo):
  - **Meta**: `X-Hub-Signature-256: sha256=<hex>` = HMAC-SHA256(raw, `META_APP_SECRET`);
    además el GET handshake devuelve `hub.challenge` en texto plano.
    (Ver `app/api/webhooks/meta-leads/route.ts`.)
  - **Svix** (Fathom/Resend): `whsec_` + headers `webhook-id/timestamp/signature`.
  - **Calendly**: `t=,v1=` hex sobre `t.body`.
  - **Shared secret** (Chatwoot/Evolution): `?secret=` o header, comparado seguro.
- Anti-replay: ventana de ~300s sobre el timestamp firmado donde aplique.

## Resolver el workspace (el leak clásico)

Sin sesión, `getWorkspaceActual()` cae a `OWNER_WS`. Decidí EXPLÍCITO:
- **Mapear un id GLOBAL del payload → workspace** con `getSupabaseServer()` (ej.
  Evolution: `instance_name`; Chatwoot: teléfono → lead), y después
  `runWithWorkspace(ws, fn)` para escribir con scope.
- O aceptar el fallback al dueño **a propósito** (Calendly/meta-leads hoy: todos al
  ws1) — pero dejalo comentado como limitación conocida, no accidental.

## Códigos de estado (es una decisión, no cosmética)

- **401** firma inválida · **400** JSON inválido.
- **200 aunque falle NUESTRO procesamiento** cuando NO querés que el proveedor
  reintente (batches: Meta reintenta todo el lote; Resend/Evolution). Aislá el error
  por-ítem y seguí.
- **500** cuando SÍ querés forzar el reintento del proveedor (Fathom/Calendly).

## No olvidar

- Agregá la ruta a `PUBLICOS` en `middleware.ts` (si no, el gate de login la corta 401).
- Log `[webhook:<provider>] … ms=<t>`.

Relacionado: `app/api/webhooks/meta-leads/route.ts` (X-Hub + challenge + batch),
`lib/workspace.ts` (runWithWorkspace), skill `tenant-safe-query`. La lib del
proveedor y sus creds → `add-provider-integration`.
