---
name: add-provider-integration
description: >
  Agregar un cliente de un servicio externo (lib/<provider>.ts) en este repo, con
  credenciales por-workspace y registrado en los DOS catálogos. Usar al conectar
  una API nueva (ads/mensajería/reuniones/datos). El error clásico: el `env` del
  catálogo NO coincide con lo que lee la lib → credWs devuelve null en silencio.
---

# Agregar una integración de proveedor

Cada proveedor es una lib cliente + su registro en DOS catálogos. Las credenciales
son **por-workspace** (cifradas), no env sueltas.

## La lib cliente (`lib/<provider>.ts`)

```ts
import 'server-only';
import { credWs } from './credenciales';

// Resolver de config: per-cliente por credWs(); global (plataforma agencia) por env.
async function cfg() {
  const token = await credWs('MIPROV_API_TOKEN');   // MISMA key que el catálogo
  if (!token) throw new Error('MiProv no configurado');
  return { token };
}
export async function miProvConfigurado(): Promise<boolean> {
  return Boolean(await credWs('MIPROV_API_TOKEN'));  // NO lanza (lo usa integraciones)
}
async function mpFetch(path: string, init?: RequestInit) {
  const { token } = await cfg();
  const res = await fetch(`https://api.miprov.com${path}`, {
    ...init, headers: { authorization: `Bearer ${token}`, ...init?.headers },
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  if (!res.ok) return { ok: false as const, error: `MiProv ${res.status}: ${text.slice(0, 200)}` };
  try { return { ok: true as const, data: JSON.parse(text) }; }
  catch { return { ok: false as const, error: 'respuesta no-JSON' }; }
}
```

## Reglas de credenciales (multi-tenant)

- **Per-cliente → `credWs('CLAVE')`** (`lib/credenciales.ts`): dueño usa env de
  Vercel, cliente su fila cifrada. NUNCA `process.env` directo para servicios
  per-cliente.
- **Servicio global de la agencia** (Telegram/Google/Anthropic/OpenAI/Supabase):
  ese sí lee `process.env`; marcalo `global: true` en `integraciones.ts`.
- **Placeholder `PENDING…`** cuenta como NO configurado (`esValorReal` lo filtra).
- **Excepción documentada**: una key compartida de una cuenta única de la agencia
  (Resend/Evolution Opción A) puede caer al env global, pero el remitente/dominio
  sigue siendo por-workspace. Dejalo comentado.

## Registrar en los DOS catálogos (el paso que se olvida)

1. **`lib/metodo-catalogo.ts` → `SERVICIOS_METODO`**: agregá un `ServicioMetodo` con
   `campos: [{ env, label, secreto?, opcional?, placeholder?, nota?, host? }]` y un
   `tutorial`. **El `env` de cada campo ES la key de `credWs` Y de `process.env`** —
   si no coincide EXACTO con lo que lee la lib, `credWs` devuelve null sin error.
   `integracionConectada` exige todos los campos no-`opcional`.
2. **`lib/integraciones.ts` → `DEFS`**: agregá `{ key, nombre, categoria, descripcion,
   envs: [...], global? }`. Los `envs` deben ser las mismas keys. `global:true` solo
   para plataforma de la agencia.

## Verificar

`npx tsc --noEmit`. Confirmá que las 3 listas de keys (lib, metodo-catalogo,
integraciones) sean idénticas. Plantillas a copiar: `lib/chatwoot.ts` /
`lib/meta-ads.ts` (per-cliente, con backoff y errores tipados). Relacionado:
`lib/credenciales.ts` (credWs/integracionConectada/esValorReal), skill
`tenant-safe-query`. Para webhooks entrantes de este proveedor → `add-webhook-receiver`.
