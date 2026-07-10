---
name: add-cron-job
description: >
  Crear un cron job de Vercel en este repo (route handler + registro en
  vercel.json), con el auth compartido y la iteración multi-tenant correctos.
  Usar cuando pidan agregar/agendar una tarea programada (ingesta diaria, poll,
  reporte). Evita reimplementar el checkAuth (ya hay 9 copias duplicadas).
---

# Agregar un cron job

Un cron son DOS cosas: un route handler bajo `app/api/cron/<nombre>/route.ts` y una
entrada en `vercel.json`. Vercel pega el endpoint según el schedule, firmado con
`Authorization: Bearer ${CRON_SECRET}`.

## El route handler

```ts
import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { correrPorWorkspace } from '@/lib/cron-workspaces';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // rutas pesadas (ingesta/IA). Default 60 si es liviano.

export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req);   // NO redeclarar un checkAuth local
  if (denied) return denied;

  const resultados = await correrPorWorkspace('meta', async (ws) => {
    // … el trabajo. Adentro, getTenantDb()/credWs()/getSetting() ya scopean a `ws`.
    return { procesados: 0 };
  });

  const algunoOk = resultados.some((r) => r.ok);
  return Response.json({ ok: algunoOk, resultados }, { status: algunoOk ? 200 : 500 });
}
```

## Reglas

- **Usá `checkCronAuth` de `lib/cron-auth.ts`** — NO copies un `checkAuth` local (hay
  9 rutas que lo duplican byte a byte; no sumes la 10ª). Fail-closed: sin
  `CRON_SECRET` en env → 500; Bearer que no matchea → 401.
- **Ingesta por-cliente → envolvé en `correrPorWorkspace('<servicio>', fn)`**
  (`lib/cron-workspaces.ts`): itera los workspaces ACTIVOS con la integración
  `<servicio>` conectada, cada uno dentro de `runWithWorkspace(ws)`. El string
  `<servicio>` debe ser una key de `metodo-catalogo`/`integraciones` (ej. `'meta'`,
  `'fathom'`, `'panda'`). Un workspace que falla NO corta a los demás.
- **Config por-workspace** con `configWs('clave', process.env.FALLBACK)`: cae al env
  global SOLO para el dueño; para un cliente sin la setting devuelve `null`
  (fail-closed — jamás ingesta el video/página de Mauricio en otro negocio).
- **Devolvé 500 si TODOS los workspaces fallan** (que el monitoreo del cron lo vea);
  200 si al menos uno anduvo.
- **Timeout de fetch externos**: `AbortSignal.timeout(ms)` para no colgar la función
  hasta `maxDuration` si una API remota no responde.

## Registrar en vercel.json

Agregá `{ "path": "/api/cron/<nombre>", "schedule": "<cron UTC>" }` al array `crons`.
Los schedules son **UTC** (local Tijuana ≈ UTC-7, o sea 13:00 UTC ≈ 6am). **Escaloná
el minuto** contra los jobs existentes para no dispararlos todos juntos (mirá los
minutos ya usados: :00, :10, :15, :20, :30, :45). Rango horario ej.
`"0 15-23 * * *"` (cada hora en ventana), semanal `"20 14 * * 1"` (lunes).

## Verificar

`npx tsc --noEmit` para tipos. En local no hay claves de Supabase (no corre data),
así que el chequeo práctico es el typecheck + revisar que el `<servicio>` sea una
key real. Relacionado: `lib/cron-auth.ts`, `lib/cron-workspaces.ts`
(correrPorWorkspace/configWs), skill `tenant-safe-query`, `vercel.json`.
