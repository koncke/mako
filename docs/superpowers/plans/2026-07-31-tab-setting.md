# Tab Setting — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tab `/setting` con la vista Jugadas (secuencias + estrategia + métricas reales), el wizard "Nueva jugada" de 7 pasos y la prueba en vivo, según `docs/superpowers/specs/2026-07-31-tab-setting-design.md`.

**Architecture:** Enfoque B (cockpit aditivo): capa nueva por encima del motor de nutrición existente. Una columna jsonb `estrategia` en `nutricion_secuencias`, una lib pura de métricas agregadas desde tablas existentes, dos routes bajo `/api/setting`, y una page + client-app siguiendo el patrón del repo (server wrapper con guard + `XApp.tsx`).

**Tech Stack:** Next.js 16 App Router (convenciones del repo — leer skill `nextjs16-conventions`), Supabase vía `getTenantDb`, `chatCheap` (lib/ai-cheap) para sugerencias, `generarSecuencia` (lib/nutricion-generator) para redactar, node:test para units.

## Global Constraints

- Multi-tenant SIEMPRE: `getTenantDb`/`getSetting` scopean; nada de `getSupabaseServer` para datos por-cliente (skill `tenant-safe-query`).
- Reuniones en UI = R1/R2, nunca J1/J2. Sin `<select>` nativo → `app/components/Dropdown.tsx`. Tokens CSS de globals (`--ink/--dim/--surface/...`).
- Roles: la tab la ven admin+setter (`requireRolWs(['setter'])`); escribir estrategia / probar / activar = admin (guard server-side en la API).
- Prompts nuevos de IA → registrados editables en `lib/prompt-registry.ts` con `{{slots}}` (skill `add-editable-prompt`); sugerencias con `chatCheap`, jamás Opus hardcodeado.
- Migraciones con skill `author-numbered-migration`; aplicar con `node scripts/apply-migration.mjs supabase/migrations/0107_setting_estrategia.sql`.
- Typecheck local antes de cada commit (`npm run typecheck`); push agrupado al final (cada push ≈ US$0.09 de build).
- La prueba en vivo NUNCA escribe en `nutricion_inscripciones`/`nutricion_envios` ni manda a leads: solo al contacto de `getContactoReportes()`.

---

### Task 1: Migración `estrategia` + tipo + parser tolerante

**Files:**
- Create: `supabase/migrations/0107_setting_estrategia.sql`
- Create: `lib/setting-estrategia.ts`
- Test: `tests/setting-estrategia.test.ts`

**Interfaces:**
- Produces: `type Estrategia = { objetivo: 'agendar'|'reactivar'|'cualificar'|'confirmar_pago'; gancho: string|null; lead_magnet_id: number|null; preguntas: string[]; notas: string|null; probada_at: string|null }`, `parseEstrategia(raw: unknown): Estrategia | null`, `OBJETIVOS: Array<{ value: Estrategia['objetivo']; label: string }>`.

- [ ] **Step 1: Migración**

```sql
-- 0107: jugadas de setting — estrategia por secuencia (tab /setting)
-- estrategia = { objetivo, gancho, lead_magnet_id, preguntas[], notas, probada_at }
-- null = secuencia sin jugada definida. Shape validada en app (lib/setting-estrategia.ts).
alter table nutricion_secuencias add column if not exists estrategia jsonb;
```

- [ ] **Step 2: Test del parser (falla)** — `tests/setting-estrategia.test.ts`

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEstrategia } from '../lib/setting-estrategia';

test('null/garbage → null', () => {
  assert.equal(parseEstrategia(null), null);
  assert.equal(parseEstrategia('x'), null);
  assert.equal(parseEstrategia({ objetivo: 'inventado' }), null);
});

test('shape completa pasa y normaliza', () => {
  const e = parseEstrategia({ objetivo: 'reactivar', gancho: 'guía PDF', preguntas: ['¿Facturás +100k?', 42], lead_magnet_id: '7', notas: null, probada_at: null });
  assert.equal(e?.objetivo, 'reactivar');
  assert.deepEqual(e?.preguntas, ['¿Facturás +100k?']);   // no-strings afuera
  assert.equal(e?.lead_magnet_id, 7);                      // número tolerante
});

test('parciales rellenan defaults', () => {
  const e = parseEstrategia({ objetivo: 'agendar' });
  assert.deepEqual(e, { objetivo: 'agendar', gancho: null, lead_magnet_id: null, preguntas: [], notas: null, probada_at: null });
});
```

- [ ] **Step 3: Implementación** — `lib/setting-estrategia.ts` (SIN `server-only`: lo importan tests y client-types)

```ts
// =============================================================================
// setting-estrategia — la JUGADA de una secuencia de nutrición (tab /setting)
// =============================================================================
// Vive en nutricion_secuencias.estrategia (jsonb, mig 0107). null = sin jugada.
// Parser TOLERANTE (patrón getSettingNum): basura → null, parciales → defaults.

export type Objetivo = 'agendar' | 'reactivar' | 'cualificar' | 'confirmar_pago';

export type Estrategia = {
  objetivo: Objetivo;
  gancho: string | null;
  lead_magnet_id: number | null;
  preguntas: string[];        // cualificación — las hereda el Setter IA (fase 2)
  notas: string | null;
  probada_at: string | null;  // última prueba en vivo OK
};

export const OBJETIVOS: Array<{ value: Objetivo; label: string }> = [
  { value: 'agendar', label: 'Agendar una reunión' },
  { value: 'reactivar', label: 'Reactivar (con gancho / lead magnet)' },
  { value: 'cualificar', label: 'Cualificar con preguntas' },
  { value: 'confirmar_pago', label: 'Confirmar el pago' },
];

const OBJ_SET = new Set(OBJETIVOS.map((o) => o.value));

export function parseEstrategia(raw: unknown): Estrategia | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.objetivo !== 'string' || !OBJ_SET.has(r.objetivo as Objetivo)) return null;
  const num = Number(r.lead_magnet_id);
  return {
    objetivo: r.objetivo as Objetivo,
    gancho: typeof r.gancho === 'string' && r.gancho.trim() ? r.gancho.trim() : null,
    lead_magnet_id: Number.isFinite(num) && num > 0 ? num : null,
    preguntas: Array.isArray(r.preguntas) ? r.preguntas.filter((p): p is string => typeof p === 'string' && p.trim().length > 0) : [],
    notas: typeof r.notas === 'string' && r.notas.trim() ? r.notas.trim() : null,
    probada_at: typeof r.probada_at === 'string' ? r.probada_at : null,
  };
}
```

- [ ] **Step 4: Correr** `npm test` → los 3 tests nuevos PASS (y los 108 previos siguen). Aplicar la migración: `node scripts/apply-migration.mjs supabase/migrations/0107_setting_estrategia.sql`.
- [ ] **Step 5: Commit** `git add supabase/migrations/0107_setting_estrategia.sql lib/setting-estrategia.ts tests/setting-estrategia.test.ts && git commit -m "feat(setting): migración estrategia + parser tolerante"`

### Task 2: Métricas de jugadas (agregador puro + fetch)

**Files:**
- Create: `lib/setting-metricas.ts`
- Test: `tests/setting-metricas.test.ts`

**Interfaces:**
- Consumes: `getSecuenciasConStats()` de `@/lib/nutricion` (id/clave/nombre/etapa/trigger_tipo/activa/pasos), `getTenantDb`.
- Produces: `type MetricasJugada = { enviadosWa: number; enviadosEmail: number; respuestas: number; abiertos: number; clics: number; inscriptosActivos: number; completados: number }`, `agregarMetricas(envios, inscripciones): Map<number, MetricasJugada>` (PURA), `getJugadas(): Promise<Jugada[]>` donde `Jugada = SecuenciaConStats & { estrategia: Estrategia | null; metricas: MetricasJugada }`.

- [ ] **Step 1: Test del agregador puro (falla)** — filas sintéticas:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agregarMetricas } from '../lib/setting-metricas';

test('agrega por secuencia: canales, respuestas, opens', () => {
  const envios = [
    { secuencia_id: 1, canal: 'whatsapp', estado: 'enviado', abierto_at: null, clic_at: null },
    { secuencia_id: 1, canal: 'email', estado: 'enviado', abierto_at: '2026-07-30', clic_at: null },
    { secuencia_id: 1, canal: 'email', estado: 'fallo', abierto_at: null, clic_at: null },   // no cuenta
    { secuencia_id: 2, canal: 'email', estado: 'enviado', abierto_at: '2026-07-30', clic_at: '2026-07-30' },
  ];
  const inscs = [
    { secuencia_id: 1, estado: 'activa' }, { secuencia_id: 1, estado: 'respondio' }, { secuencia_id: 2, estado: 'completada' },
  ];
  const m = agregarMetricas(envios, inscs);
  assert.deepEqual(m.get(1), { enviadosWa: 1, enviadosEmail: 1, respuestas: 1, abiertos: 1, clics: 0, inscriptosActivos: 1, completados: 0 });
  assert.deepEqual(m.get(2), { enviadosWa: 0, enviadosEmail: 1, respuestas: 0, abiertos: 1, clics: 1, inscriptosActivos: 0, completados: 1 });
});
```

- [ ] **Step 2: Implementación** — `lib/setting-metricas.ts`: el agregador SIN `server-only` ni IO (recibe filas), y el fetch aparte:

```ts
// =============================================================================
// setting-metricas — números de cada jugada (tab /setting)
// =============================================================================
// Agregador PURO (testeable) + fetch por workspace. Ventana: últimos 30 días.
// Fuentes existentes: nutricion_envios (enviados + abierto_at/clic_at del
// webhook de Resend) y nutricion_inscripciones (respondio = la pausa).

export type FilaEnvio = { secuencia_id: number | null; canal: string; estado: string; abierto_at: string | null; clic_at: string | null };
export type FilaInsc = { secuencia_id: number | null; estado: string };

export type MetricasJugada = {
  enviadosWa: number; enviadosEmail: number; respuestas: number;
  abiertos: number; clics: number; inscriptosActivos: number; completados: number;
};

const CERO: MetricasJugada = { enviadosWa: 0, enviadosEmail: 0, respuestas: 0, abiertos: 0, clics: 0, inscriptosActivos: 0, completados: 0 };

export function agregarMetricas(envios: FilaEnvio[], inscripciones: FilaInsc[]): Map<number, MetricasJugada> {
  const out = new Map<number, MetricasJugada>();
  const de = (id: number) => { if (!out.has(id)) out.set(id, { ...CERO }); return out.get(id)!; };
  for (const e of envios) {
    if (e.secuencia_id == null) continue;
    const m = de(e.secuencia_id);
    if (e.estado === 'enviado') { if (e.canal === 'whatsapp') m.enviadosWa += 1; else if (e.canal === 'email') m.enviadosEmail += 1; }
    if (e.abierto_at) m.abiertos += 1;
    if (e.clic_at) m.clics += 1;
  }
  for (const i of inscripciones) {
    if (i.secuencia_id == null) continue;
    const m = de(i.secuencia_id);
    if (i.estado === 'activa') m.inscriptosActivos += 1;
    else if (i.estado === 'respondio') m.respuestas += 1;
    else if (i.estado === 'completada') m.completados += 1;
  }
  return out;
}
```

El fetch (en el mismo archivo, detrás de un import dinámico de server-only NO: separar — crear `lib/setting-jugadas.ts` `import 'server-only'`):

```ts
// lib/setting-jugadas.ts
import 'server-only';
import { getTenantDb } from './workspace';
import { getSecuenciasConStats, type SecuenciaConStats } from './nutricion';
import { parseEstrategia, type Estrategia } from './setting-estrategia';
import { agregarMetricas, type FilaEnvio, type FilaInsc, type MetricasJugada } from './setting-metricas';

export type Jugada = SecuenciaConStats & { estrategia: Estrategia | null; metricas: MetricasJugada };

export async function getJugadas(): Promise<Jugada[]> {
  const supabase = await getTenantDb();
  const desde = new Date(Date.now() - 30 * 86400 * 1000).toISOString();
  const [secs, estrategias, envios, inscs] = await Promise.all([
    getSecuenciasConStats(),
    supabase.from('nutricion_secuencias').select('id, estrategia'),
    supabase.from('nutricion_envios').select('secuencia_id, canal, estado, abierto_at, clic_at').gte('created_at', desde),
    supabase.from('nutricion_inscripciones').select('secuencia_id, estado'),
  ]);
  const estMap = new Map(((estrategias.data ?? []) as Array<{ id: number; estrategia: unknown }>).map((r) => [r.id, parseEstrategia(r.estrategia)]));
  const met = agregarMetricas((envios.data ?? []) as FilaEnvio[], (inscs.data ?? []) as FilaInsc[]);
  const CERO = { enviadosWa: 0, enviadosEmail: 0, respuestas: 0, abiertos: 0, clics: 0, inscriptosActivos: 0, completados: 0 };
  return secs.map((s) => ({ ...s, estrategia: estMap.get(s.id) ?? null, metricas: met.get(s.id) ?? CERO }));
}

export async function guardarEstrategia(secuenciaId: number, estrategia: Estrategia): Promise<void> {
  const supabase = await getTenantDb();
  const { data } = await supabase.from('nutricion_secuencias').select('id').eq('id', secuenciaId).maybeSingle();
  if (!data) throw new Error('Esa secuencia no existe en este workspace.');
  const { error } = await supabase.from('nutricion_secuencias')
    .update({ estrategia, updated_at: new Date().toISOString() }).eq('id', secuenciaId);
  if (error) throw new Error(`guardarEstrategia: ${error.message}`);
}
```

- [ ] **Step 3:** `npm test` PASS · **Step 4: Commit** `feat(setting): métricas de jugadas (agregador puro + fetch)`

### Task 3: API `/api/setting/jugadas` (GET + POST)

**Files:**
- Create: `app/api/setting/jugadas/route.ts`
- Modify: `lib/prompt-registry.ts` (registrar `setting.gancho` y `setting.preguntas`)

**Interfaces:**
- Consumes: `getJugadas/guardarEstrategia` (Task 2), `parseEstrategia`, `chatCheap({system,user,json,feature})` de `@/lib/ai-cheap`, `getRolWsEfectivo/getWorkspaceActual`, `renderPrompt` de `@/lib/prompt-render`, `perfilNegocioTexto` de `@/lib/onboarding`, `probarSecuencia` (Task 5 — el route la cablea recién en esa task).
- Produces: `GET → { ok, jugadas: Jugada[], rolAdmin: boolean }` · `POST {action:'sugerir-gancho'|'sugerir-preguntas'} → { ok, sugerencias: string[] }` · `POST {action:'guardar-estrategia', secuenciaId, estrategia} → { ok }`.

- [ ] **Step 1: Prompts editables** en `lib/prompt-registry.ts`, mismos bloques que los `nutri.*` existentes (copiar patrón de registro contiguo):

```ts
// Tab Setting — sugerencias del wizard de jugadas (chatCheap)
registrar('setting.gancho', {
  titulo: 'Setting — sugerir ganchos', area: 'nutricion',
  descripcion: 'Tres ganchos/lead magnets para una jugada, según objetivo y negocio.',
  slots: ['objetivo', 'etapa', 'perfil'],
  default: SETTING_GANCHO_TEMPLATE,
});
registrar('setting.preguntas', {
  titulo: 'Setting — sugerir preguntas de cualificación', area: 'nutricion',
  descripcion: 'Preguntas cerradas para cualificar al lead por mensajes.',
  slots: ['objetivo', 'etapa', 'perfil'],
  default: SETTING_PREGUNTAS_TEMPLATE,
});
```

(los templates viven en el route o en `lib/setting-jugadas.ts`; texto exacto en Step 2. **OJO**: verificar la firma real de registro en `lib/prompt-registry.ts` antes — si el registro es un objeto literal exportado y no una función `registrar`, seguir ese patrón. Correr skill `verify-prompt-registry-sync` al final de la task.)

- [ ] **Step 2: Route** — `app/api/setting/jugadas/route.ts`:

```ts
// =============================================================================
// API: jugadas de setting (tab /setting)
// =============================================================================
// GET  → { jugadas, rolAdmin } (admin y setter; setter solo lectura).
// POST → admin-only: sugerir-gancho | sugerir-preguntas | guardar-estrategia | probar.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { getJugadas, guardarEstrategia, probarSecuencia, SETTING_GANCHO_TEMPLATE, SETTING_PREGUNTAS_TEMPLATE } from '@/lib/setting-jugadas';
import { parseEstrategia, OBJETIVOS } from '@/lib/setting-estrategia';
import { chatCheap } from '@/lib/ai-cheap';
import { renderPrompt } from '@/lib/prompt-render';
import { perfilNegocioTexto } from '@/lib/onboarding';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function GET() {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || (rol !== 'admin' && rol !== 'setter')) {
    return Response.json({ ok: false, error: 'Sin acceso a Setting en este workspace.' }, { status: 403 });
  }
  try {
    return Response.json({ ok: true, jugadas: await getJugadas(), rolAdmin: rol === 'admin', objetivos: OBJETIVOS });
  } catch (e) {
    console.error(`[api:setting/jugadas GET] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

async function sugerir(template: string, key: string, objetivo: string, etapa: string): Promise<string[]> {
  const perfil = await perfilNegocioTexto().catch(() => '');
  const user = await renderPrompt(key, template, { objetivo, etapa, perfil: perfil || '(sin perfil cargado)' });
  const raw = await chatCheap({ system: 'Devolvé EXCLUSIVAMENTE un array JSON de strings en español neutro rioplatense del negocio. Sin markdown.', user, json: true, feature: 'setting-sugerencias', maxTokens: 600 });
  try { const arr = JSON.parse(raw); return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string').slice(0, 5) : []; }
  catch { return []; }
}

export async function POST(req: NextRequest) {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') {
    return Response.json({ ok: false, error: 'Solo el admin del workspace puede editar jugadas.' }, { status: 403 });
  }
  let body: { action?: string; secuenciaId?: unknown; estrategia?: unknown; objetivo?: unknown; etapa?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  try {
    if (body.action === 'sugerir-gancho' || body.action === 'sugerir-preguntas') {
      const objetivo = String(body.objetivo ?? '');
      const etapa = String(body.etapa ?? '');
      const [tpl, key] = body.action === 'sugerir-gancho'
        ? [SETTING_GANCHO_TEMPLATE, 'setting.gancho'] : [SETTING_PREGUNTAS_TEMPLATE, 'setting.preguntas'];
      return Response.json({ ok: true, sugerencias: await sugerir(tpl, key, objetivo, etapa) });
    }
    if (body.action === 'guardar-estrategia') {
      const id = Number(body.secuenciaId);
      const est = parseEstrategia(body.estrategia);
      if (!Number.isFinite(id) || !est) return Response.json({ ok: false, error: 'estrategia inválida' }, { status: 400 });
      await guardarEstrategia(id, est);
      return Response.json({ ok: true });
    }
    if (body.action === 'probar') {
      const id = Number(body.secuenciaId);
      if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'secuenciaId inválido' }, { status: 400 });
      const r = await probarSecuencia(id);
      return Response.json(r.ok ? { ok: true, ...r } : { ok: false, error: r.error }, { status: r.ok ? 200 : 400 });
    }
    return Response.json({ ok: false, error: 'action inválida' }, { status: 400 });
  } catch (e) {
    console.error(`[api:setting/jugadas POST] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}
```

Templates (en `lib/setting-jugadas.ts`, exportados):

```ts
export const SETTING_GANCHO_TEMPLATE = `Sos MaKo armando una jugada de setting. El negocio: {{perfil}}.
Objetivo de la jugada: {{objetivo}}. Etapa del lead: {{etapa}}.
Proponé 3 GANCHOS concretos (lead magnet, oferta puntual, motivo de re-contacto) que este negocio puede ofrecer YA — nada genérico, nada de inventar recursos que no existen: derivalos del perfil. Máx 15 palabras cada uno.
Devolvé un array JSON de 3 strings.`;

export const SETTING_PREGUNTAS_TEMPLATE = `Sos MaKo armando la cualificación por WhatsApp de una jugada de setting. El negocio: {{perfil}}.
Objetivo: {{objetivo}}. Etapa del lead: {{etapa}}.
Proponé 4 PREGUNTAS de cualificación cerradas y cortas (responder toma <15 segundos), en el orden en que un setter las haría, que separen a un lead calificado de uno que no. Sin preguntas obvias ni invasivas.
Devolvé un array JSON de 4 strings.`;
```

- [ ] **Step 3:** `npm run typecheck` (fallará por `probarSecuencia` inexistente hasta la Task 5 — para poder commitear, exportar en `lib/setting-jugadas.ts` un stub REAL que devuelve `{ ok: false, error: 'La prueba en vivo llega en el próximo hito.' }` y reemplazarlo en la Task 5).
- [ ] **Step 4: Commit** `feat(setting): API de jugadas (métricas + sugerencias con chatCheap)`

### Task 4: Nav + capas + page + vista Jugadas

**Files:**
- Modify: `app/_components/nav.ts` (grupo `chats`, ARRIBA de whatsapp)
- Modify: `lib/capas.ts` (agregar `'setting'` a los `navKeys` de toda capa que liste `'whatsapp'` o `'email'`; las de `navKeys: null` ya la ven)
- Create: `app/setting/page.tsx`, `app/setting/SettingApp.tsx`

**Interfaces:**
- Consumes: `GET /api/setting/jugadas` (Task 3), `ETAPA_SEQ_LABEL`-style labels (copiar el objeto de WhatsAppApp.tsx:902 — fuente única no existe aún, NO refactorizar ahora), `requireRolWs` de `@/lib/tab-access`.
- Produces: ruta `/setting` funcionando con lista de jugadas + CTA "definir jugada" (el wizard llega en Task 6; el botón abre el modal vacío con mensaje "próximo hito" hasta entonces — NO: el botón se oculta detrás de `wizardListo=false` const local hasta Task 6).

- [ ] **Step 1: nav.ts** — dentro del grupo `chats`, primera posición:

```ts
      { key: 'setting', label: 'Setting', href: '/setting', icon: 'target', rolesWs: ['setter'], match: starts('/setting') },
```

(verificar que exista el icon `target` en el set de `Icon`; si no, usar `'crm'` u otro existente — NO inventar SVG en esta task.)

- [ ] **Step 2: page.tsx** (patrón del repo):

```tsx
import { requireRolWs } from '@/lib/tab-access';
import { SettingApp } from './SettingApp';

export const dynamic = 'force-dynamic';

export default async function SettingPage() {
  await requireRolWs(['setter']);
  return <SettingApp />;
}
```

- [ ] **Step 3: SettingApp.tsx** — client component: header ("Setting" + subtítulo corto), fetch inicial de `/api/setting/jugadas`, grid de cards de jugadas: nombre, chip de etapa, chip activa/pausada, badge "sin jugada definida" cuando `estrategia == null`, y la fila de métricas (`enviados WA · enviados email · respuestas · aperturas · clics · activos`). Estados: loading, error, vacío ("Todavía no hay secuencias — creá la primera desde el wizard o desde WhatsApp"). Estilos con tokens del repo, sin colores hardcodeados. (~150 líneas; seguir la estética de cards de WhatsAppApp.)
- [ ] **Step 4:** `npm run typecheck` + verificar en preview: la tab aparece en Chats, carga jugadas del ws actual, setter NO ve botones de edición (rolAdmin=false).
- [ ] **Step 5: Commit** `feat(setting): tab /setting con vista Jugadas y métricas`

### Task 5: Prueba en vivo (`probarSecuencia`)

**Files:**
- Modify: `lib/setting-jugadas.ts` (reemplazar el stub)

**Interfaces:**
- Consumes: `getContactoReportes()` de `@/lib/perfil` (`{ nombre, email, telefono }`), `enviarYEspejar({ telefono, texto, leadId? })` de `@/lib/evolution-envio` (verificar si `leadId` es opcional; si es requerido, usar la variante de envío directo de `lib/evolution.ts` — el implementador DEBE leer ambas firmas), `getInstanciaRow()` de `@/lib/evolution`, `sendEmail` + `renderEmailHtml` de `@/lib/resend`, `aplicarVariables/valoresVariablesLead` de `@/lib/template-vars`, `getSecuenciasConStats`.
- Produces: `probarSecuencia(secuenciaId): Promise<{ ok: true; enviadosWa: number; enviadosEmail: number; avisos: string[] } | { ok: false; error: string }>`.

- [ ] **Step 1: Implementación** — reglas exactas:
  - Cargar la secuencia; sin pasos → error claro.
  - Contacto de `getContactoReportes()`; sin teléfono NI email → `{ ok:false, error: 'Cargá tu teléfono y email en Perfil para recibir la prueba.' }`.
  - Por cada paso, texto = `aplicarVariables(cuerpo, valoresVariablesLead({ nombre: contacto.nombre || 'Prueba' }))` con prefijo `[PRUEBA ${orden}/${total}] `.
  - Pasos WhatsApp → SOLO si `getInstanciaRow()?.estado === 'conectado'`: enviar por el canal no oficial al teléfono del contacto; si no está conectada, sumar aviso `'WhatsApp de empresa sin conectar: los pasos de WhatsApp no se probaron'`.
  - Pasos email → `sendEmail` al email del contacto con asunto `[PRUEBA] ${asunto}`; si `remitenteEsSandbox()`, aviso en vez de envío.
  - Al terminar con ≥1 envío OK: `guardarEstrategia` merge de `probada_at = new Date().toISOString()` (leer estrategia actual, si es null NO crearla — la prueba también sirve para secuencias sin jugada; en ese caso no persiste nada).
  - JAMÁS tocar `nutricion_inscripciones`/`nutricion_envios`.
- [ ] **Step 2:** typecheck + probar desde la API con curl o desde la UI (Task 6 la cablea); prueba real en el workspace Pruebas.
- [ ] **Step 3: Commit** `feat(setting): prueba en vivo de una secuencia al contacto del admin`

### Task 6: Wizard "Nueva jugada" (pasos 1-7)

**Files:**
- Create: `app/setting/JugadaWizard.tsx`
- Modify: `app/setting/SettingApp.tsx` (botones "Nueva jugada" / "Definir jugada" / "Probar en vivo", solo `rolAdmin`)
- Modify: `lib/nutricion-generator.ts` (inyectar estrategia al system de `generarSecuencia`)

**Interfaces:**
- Consumes: `GET /api/setting/jugadas` (objetivos + jugadas), `POST` actions (Task 3/5), `POST /api/mako/nutricion {action:'generar'|'aplicar'}` (existente), `PATCH /api/whatsapp/secuencias {id, activa}` (existente), `getFunnel`-derived etapa options — expuestas agregando `etapas: Array<{value,label}>` al GET de jugadas (derivar server-side de `getFunnel().stages` banda `nutricion` + pipeline, labels reales).
- Produces: flujo completo: ① cohorte (Dropdown de etapas del funnel; "secuencia existente" también elegible) → ② objetivo (chips) → ③ gancho (si el workspace tiene Entregable/lead magnet en la fábrica de creativos, se ofrece PRIMERO con su nombre — buscar la tabla del Entregable con grep 'entregable' en lib/ y exponerla en el GET como `leadMagnets: Array<{id, nombre}>`; después las sugerencias de `sugerir-gancho` + input libre) → ④ preguntas (sugerencias de `sugerir-preguntas`, lista editable) → ⑤ `guardar-estrategia` + generar copy (action `generar` del route de mako, mostrando preview editable) → ⑥ botón "Probame la secuencia" (`action probar`, muestra avisos) → ⑦ "Aprobar y activar" (action `aplicar` + PATCH activa) → cierra y recarga jugadas.
- En `generarSecuencia`: si la secuencia tiene `estrategia`, sumar al system:

```ts
  // (después del bloque FUNNEL REAL)
  const est = parseEstrategia((sec as { estrategia?: unknown }).estrategia);
  if (est) {
    system += `\n\nJUGADA DE ESTA SECUENCIA (escribí al servicio de esto):\n- Objetivo: ${est.objetivo}\n- Gancho: ${est.gancho ?? '(sin gancho definido)'}\n- Preguntas de cualificación a sembrar con naturalidad: ${est.preguntas.join(' · ') || '(ninguna)'}`;
  }
```

  (requiere que `getSecuenciasConStats` seleccione también `estrategia` — agregar la columna al select y al tipo `SecuenciaConStats` en `lib/nutricion.ts`.)
- Si el paso ① crea secuencia nueva: `POST /api/whatsapp/secuencias`… no existe create — agregar action `crear` al POST de `/api/setting/jugadas`: inserta en `nutricion_secuencias` `{ clave: 'jugada-<etapa>-<ts>', nombre, etapa, trigger_tipo: 'etapa_actual', activa: false, pasos: [] }` con 2 pasos default (email 24h + waNo 48h, copy '[MaKo lo escribe en el paso 5]'), vía `getTenantDb`.
- [ ] **Step final:** typecheck + prueba E2E en preview (crear jugada → generar → probar → activar) + commit `feat(setting): wizard Nueva jugada (estrategia → MaKo → prueba en vivo → activar)`

### Task 7: Verificación final + push

- [ ] `npm test` (todos) + `npm run typecheck` + `npm run build` (rutas nuevas).
- [ ] Preview: dev-login → /setting como admin (todo el flujo) y con rol setter (solo lectura). Consola sin errores.
- [ ] Revisión tenant-safe (skill `audit-route-cross-tenant` sobre `app/api/setting/jugadas/route.ts`).
- [ ] `git push origin main` (un solo push).
