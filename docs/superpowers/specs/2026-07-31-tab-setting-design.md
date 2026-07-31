# Tab Setting — jugadas de nutrición con estrategia, prueba en vivo y números

**Fecha**: 2026-07-31 · **Estado**: aprobado el enfoque (B, "cockpit por encima") por Martín; spec en revisión.

## Norte

El diferencial no es "otro editor de mensajes": **cada secuencia se convierte en una JUGADA con estrategia** — a quién (cohorte del funnel real), con qué objetivo (agendar / reactivar / cualificar / confirmar pago), con qué gancho (lead magnet u oferta), con qué preguntas de cualificación — que MaKo redacta, que el dueño **prueba en vivo en su propio teléfono/mail antes de prender**, y que después rinde cuentas con métricas. Sin jugada definida, una secuencia es solo mensajes; con jugada, es setting.

## Contexto de descomposición

Este spec cubre SOLO el sub-proyecto 1 de tres (decisión de Martín, 2026-07-31):

1. **Tab Setting** (este documento).
2. **Setter IA de WhatsApp** — automático con guardrails desde el día 1: conversa, cualifica con las `preguntas` definidas en la jugada, agenda. Spec propia después; este diseño solo le deja los datos listos.
3. **Email sin fricción** — fase 1 subdominio gestionado por MaKo en Resend (API, cero setup del cliente, reply-to a su mail), fase 2 Gmail propio vía agregador (Unipile/Nylas). Spec propia después.

## Alcance v1

- Ruta `/setting` + entrada "Setting" en el grupo **Chats** del sidebar.
- **Vista Jugadas**: todas las secuencias del workspace con su estrategia y sus métricas.
- **Wizard "Nueva jugada"**: 7 pasos con preguntas cerradas (estilo MaKo), termina en aprobar-activa.
- **Prueba en vivo**: enviar la secuencia completa al contacto del admin antes de activar.

**Fuera de v1**: pruebas A/B (decisión explícita), el Setter IA, el canal email nuevo, mover las secuencias fuera de /whatsapp y /email (enfoque B es aditivo: el motor y las tabs existentes no cambian).

## Arquitectura

### Ruta, nav, permisos

- `app/setting/page.tsx` (server wrapper con guard) + `app/setting/SettingApp.tsx` (`'use client'`), patrón estándar del repo.
- Guard: `requireRolWs(['setter'])` — admin del workspace y setter la ven (mismo criterio que /email); closer no.
- Roles dentro de la tab: el setter VE jugadas y métricas (lectura); definir jugada, probar en vivo y activar son admin-only (server-side en la API, patrón del toggle de envío).
- Nav: item `{ key: 'setting', label: 'Setting', href: '/setting', rolesWs: ['setter'] }` en el grupo `chats` de `app/_components/nav.ts`, ARRIBA de WhatsApp (es el cockpit del proceso; WhatsApp/Email son los canales).
- Capas: agregar `'setting'` a los `navKeys` de toda capa que hoy incluya `'whatsapp'` o `'email'` (`lib/capas.ts`). Regla del repo: cero `if` por capa fuera del catálogo.
- Activación: la tab NO exige integración conectada (a diferencia de /whatsapp): las jugadas se pueden diseñar antes de conectar canales; los pasos de prueba/activación sí avisan qué falta.

### Modelo de datos (migración chica)

Columna nueva en `nutricion_secuencias`:

```sql
alter table nutricion_secuencias add column if not exists estrategia jsonb;
```

Shape (validada en app, no en DB):

```ts
type Estrategia = {
  objetivo: 'agendar' | 'reactivar' | 'cualificar' | 'confirmar_pago';
  gancho: string | null;            // texto libre de la oferta/gancho
  lead_magnet_id: number | null;    // FK débil al Entregable de la fábrica de creativos (si existe)
  preguntas: string[];              // cualificación — las hereda el Setter IA (sub-proyecto 2)
  notas: string | null;
  probada_at: string | null;        // última prueba en vivo OK
};
```

Sin tablas nuevas. `estrategia = null` ⇒ la secuencia aparece como "sin jugada definida".

### Vista Jugadas (métricas)

Una card/fila por secuencia: nombre, etapa (labels del funnel derivado), objetivo y gancho (de `estrategia`), activa/pausada, y métricas de los últimos 30 días:

| Métrica | Fuente (ya existe) |
|---|---|
| Enviados (por canal) | `nutricion_envios` estado `enviado` |
| Respuestas | `nutricion_inscripciones` estado `respondio` (la pausa-por-respuesta) |
| Aperturas / clics email | `nutricion_envios.abierto_at / clic_at` (webhook Resend, `marcarEventoEmail`) |
| Inscriptos activos / completados | `nutricion_inscripciones` |
| Esperando (canal apagado / relleno) | detalle del cron — se muestra como aviso, no como métrica |

Agregación server-side en una lib nueva `lib/setting-metricas.ts` (dos queries batch por workspace, sin N+1, `getTenantDb`). API `GET /api/setting/jugadas` → `{ jugadas: [...] }`.

Tasa de agendas atribuida queda FUERA de v1 (atribución multi-touch es un proyecto en sí); se muestra respuesta como proxy.

### Wizard "Nueva jugada" (o "definir jugada" sobre una secuencia existente)

Pasos, todos con opciones cerradas + "Otro" (regla: la IA facilita, nunca pregunta abierto):

1. **¿A quién?** — cohorte: etapas del funnel derivado del workspace (`getFunnel`) + los 13 triggers legacy con sus labels. Crea secuencia nueva (`trigger_tipo: 'etapa_actual'`) o adopta una existente sin estrategia.
2. **¿Objetivo?** — agendar · reactivar · cualificar · confirmar pago (sugerido por etapa: p.ej. `reactivacion` ⇒ reactivar).
3. **¿Gancho?** — si hay Entregable/lead magnet en la fábrica de creativos, se ofrece primero; si no, MaKo sugiere 3 ganchos según objetivo + perfil del negocio (chatCheap), editable.
4. **¿Preguntas de cualificación?** — MaKo sugiere 3-5 según objetivo/etapa (chatCheap); el usuario borra/edita/agrega. Se guardan en `estrategia.preguntas`.
5. **MaKo redacta** — `generarSecuencia` existente, con la estrategia inyectada al prompt (objetivo + gancho + preguntas como contexto adicional del system). Review editable inline (mismo componente de preview que NutricionGenerar o variante).
6. **Prueba en vivo** — envía TODOS los pasos de la secuencia, juntos y marcados como prueba, al admin: WhatsApp por `enviarYEspejar` (canal no oficial) a su teléfono, emails por `sendEmail` a su mail, con prefijo "[PRUEBA]". NO toca `nutricion_inscripciones` ni `nutricion_envios` (cero contaminación de KPIs y del guard de 20h). Requiere Evolution conectada para WA (si no, muestra solo preview + aviso). Marca `estrategia.probada_at`.
7. **Aprobar y activar** — persiste copy + estrategia y activa la secuencia (flujo aprobar-activa ya construido). Si hay pasos WA oficiales, ofrece mandar plantillas a Meta (flujo existente).

API: `POST /api/setting/jugadas` con actions `sugerir-gancho`, `sugerir-preguntas`, `guardar-estrategia`, `probar` (guard: admin del ws; la prueba en vivo es outward-facing ⇒ solo admin).

### Prompts

Los dos prompts nuevos (sugerir ganchos, sugerir preguntas) y la extensión del system de `generarSecuencia` se registran editables en `lib/prompt-registry.ts` con `{{slots}}` (skill add-editable-prompt). Modelo: `chatCheap` para sugerencias (tarea simple), el generador sigue con su feature `nutri-generar`.

### Errores y bordes

- Prueba en vivo sin teléfono/mail del admin cargado → pedirlo inline (no romper).
- Evolution desconectada → prueba solo de email + preview de WA con aviso.
- `estrategia` inválida/parcial en DB → la vista la trata como null (tolerante, patrón `getSettingNum`).
- Multi-tenant: todo por `getTenantDb`/`getSetting`; la prueba en vivo envía SOLO al contacto del admin del workspace actual (nunca a leads).

### Testing

- Unit: parser/validador de `Estrategia` (tolerante), agregador de métricas con fixtures.
- El typecheck del pre-push + prueba manual en preview (dev-login, ws de prueba) para wizard y prueba en vivo.
- La prueba en vivo se valida en el workspace Pruebas antes de anunciarla.

### Orden de implementación sugerido

1. Migración `estrategia` + lib de métricas + vista Jugadas (valor inmediato: números).
2. Wizard pasos 1-5 (estrategia + redacción con contexto).
3. Prueba en vivo + aprobar-activa (paso 6-7).
4. Nav/capas + pulido + verificación en preview.
