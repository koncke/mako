# Auditoría de aislamiento por workspace (multi-tenant)

Fecha: 2026-07-05 · Alcance: fugas de datos entre workspaces (cada usuario = su
propio workspace; ver `lib/workspace.ts`). Disparada por el bug del selector de
Setter/Closer que mostraba gente de TODOS los workspaces.

## Cómo funciona el aislamiento (contexto)

`lib/workspace.ts` expone `getTenantDb()`: un proxy de Supabase que, para las
tablas de `TENANT_TABLES`, agrega `.eq('workspace_id', ws)` a los SELECT/UPDATE/
DELETE y estampa `workspace_id` en INSERT/UPSERT. `ws` sale de la cookie de
sesión (o de la impersonación de un admin de agencia). Si `ws` es null → id
imposible (`-1`) → lecturas vacías / escrituras que fallan (fail-closed).

**Regla:** toda tabla con datos por-cliente debe leerse con `getTenantDb()` **o**
filtrarse explícitamente por `workspace_id`. `getSupabaseServer()` (crudo, sin
scope) solo es válido para: (a) tablas NO tenant, (b) operaciones de agencia
cross-workspace ya gateadas por rol de agencia, (c) endpoints públicos
autorizados por token.

`usuarios` **no** está en `TENANT_TABLES` (tiene columna `workspace_id` pero se
consulta desde muchos lugares, algunos cross-workspace legítimos). Por eso
cualquier query a `usuarios` que sea por-cliente **tiene que filtrar
`workspace_id` a mano**.

## Hallazgos

### 🔴 CONFIRMADO y CORREGIDO — `getEquipoAction` (fuga real)

`app/leads/actions.ts` · `getEquipoAction()` consultaba `usuarios` con
`getSupabaseServer()` filtrando solo por `estado != 'suspendido'` y `rol !=
'admin'`, **sin** `workspace_id`. Alimentaba los desplegables de Setter/Closer
del wizard y la card de Meetings → mostraba miembros de **todos** los
workspaces. **Fix:** ahora resuelve `getWorkspaceActual()`, filtra
`.eq('workspace_id', ws)` (y lo re-valida en memoria) y devuelve `[]` si no hay
workspace activo (admin sin impersonar). Además, Setter/Closer pasaron a ser
**seleccionables** del equipo (nunca texto libre) en el wizard y en
`EditLeadForm`. Commit `d033838`.

### 🟢 REVISADO — sin fuga (no requiere cambio)

- **`getLeadAuditAction` (autor por email).** Resuelve nombre+foto de los
  autores de un cambio consultando `usuarios` por email global. Los emails ya
  vienen del `lead_audit` (que sí está scopeado), y resolver el nombre del actor
  —incluido un admin de agencia que operó sobre ese lead— es correcto. No expone
  datos de otro workspace: solo el nombre de quien tocó ESTE lead.
- **`/api/email/unsubscribe`.** Actualiza `leads` con `getSupabaseServer()` sin
  scope, pero es un endpoint **público** (el destinatario no tiene sesión) y está
  autorizado por HMAC `verifyUnsubscribeToken(leadId, token)`. No se puede dar de
  baja a otro lead sin su token firmado. Correcto por diseño.
- **`lib/usuarios.ts`** (`listarUsuarios`, `buscarUsuarioPorEmail`, etc.). Son
  building blocks sin scope. Sus consumidores por-cliente ya filtran:
  `/api/equipo` usa `equipoDe(ws)` que filtra `rol==='usuario' && workspace_id===ws`;
  `/api/admin/*` es cross-workspace **por diseño** y está gateado por rol de
  agencia; `buscarUsuarioPorEmail` en `lib/auth`/`lib/perfil` busca al propio
  usuario logueado (email conocido).

### 🟡 RECOMENDACIONES (defensa en profundidad, no urgentes)

1. **Comentar en `lib/usuarios.ts`** cuáles funciones son cross-workspace de
   agencia vs. por-cliente, para no repetir el error de `getEquipoAction`.
2. **Regla de revisión:** cualquier `.from('usuarios')` nuevo fuera de
   `/api/admin` debe filtrar `workspace_id` o justificar por qué no.
3. Considerar un helper `equipoDelWorkspace(ws)` único (hoy la lógica vive
   duplicada en `getEquipoAction` y `equipoDe`).

## Checklist de aislamiento para features nuevas

- [ ] ¿La tabla tiene datos por-cliente? → usar `getTenantDb()` o filtrar
      `workspace_id` a mano.
- [ ] ¿Es `usuarios` u otra tabla fuera de `TENANT_TABLES`? → filtro
      `workspace_id` **explícito** obligatorio.
- [ ] ¿Es una acción de agencia cross-workspace? → gatear por rol de agencia.
- [ ] ¿Es un endpoint público? → autorizar por token firmado, nunca por id crudo.
- [ ] Fail-closed: si no hay workspace, devolver vacío / rechazar (nunca caer al
      dueño ni a "todos").
