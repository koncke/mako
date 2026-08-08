# Fix WhatsApp API authentication and authorization issues

`2026-06-23 22:48` → `2026-06-23 23:02` · 1 mensajes de Martín · 19 respuestas de Claude · sesión `ee21c942`

> Transcripción de la conversación. **No incluye las llamadas a herramientas ni sus resultados** —son el 96% del peso y no son la charla— ni el razonamiento interno de Claude. Las credenciales que aparecían en el texto están **redactadas**; el resumen de qué se hizo en cada sesión está en [chats.md](chats.md).

---

## Martín

`2026-06-23 22:48`

La revisión del inbox de WhatsApp flageó dos issues de auth pre-existentes (no introducidos por el cambio de multimedia) en los endpoints internos bajo app/api/whatsapp/ (conversations, contacts/[id]/messages, contacts/[id]/attachments, thread, lead/[id], secuencias):

1. Fail-safe de DASHBOARD_PASSWORD: el gate de auth está en middleware.ts y, según el código, hace no-op si DASHBOARD_PASSWORD no está seteada. En producción eso dejaría TODOS los endpoints abiertos si alguien olvida la env. Agregar un fail-safe: en producción (process.env.NODE_ENV === 'production' o VERCEL_ENV === 'production'), si falta DASHBOARD_PASSWORD/AUTH_COOKIE_VALUE, NEGAR el acceso a las rutas protegidas en vez de dejarlas pasar. En local/dev mantener el no-op actual para no romper el flujo sin Supabase.

2. contactId arbitrario: app/api/whatsapp/contacts/[id]/messages/route.ts y .../attachments/route.ts toman contactId crudo de la URL y mandan WhatsApp a CUALQUIER contacto de la cuenta de Chatwoot, sin validar que pertenezca al inbox de WhatsApp configurado. Como el gate es una contraseña COMPARTIDA, conviene validar server-side que el contactId esté dentro del set de contactos del inbox WA (CHATWOOT_WA_INBOX_ID) antes de enviar, o resolver el contacto desde un id de grupo del lado server en lugar de aceptar el contactId del cliente.

Revisar middleware.ts y lib/chatwoot.ts (cfg/listConversations) para el contexto. Verificar con `npx tsc --noEmit` y `npx eslint`. El repo real está en C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing/. Es un Next.js no estándar: leer node_modules/next/dist/docs antes de tocar middleware/route handlers.

### Claude

Voy a empezar explorando los archivos relevantes para entender el contexto antes de tocar nada.

### Claude

Acato la instrucción de leer la doc de esta versión no estándar de Next.js antes de tocar middleware/route handlers. Déjame explorar la doc y el resto de los endpoints de WhatsApp.

### Claude

La doc existe. Déjame leer las guías relevantes de esta versión de Next.js (middleware y route handlers) y el resto de los endpoints de WhatsApp.

### Claude

Next.js 16.2.6 — y noto que no hay `middleware.md` sino `proxy.md`. En Next 16 el middleware se renombró. Déjame leer las guías clave.

### Claude

Hallazgo clave: en Next 16 `middleware` está **deprecado y renombrado a `proxy`**. Necesito verificar si `middleware.ts` todavía se ejecuta en 16.2.6 — porque si Next 16 lo ignora, el gate de auth entero estaría muerto (un problema mayor que los dos que me pidieron). Déjame verificar eso y revisar el resto de endpoints.

### Claude

`middleware.ts` todavía genera manifest. Déjame confirmar que realmente está registrado (no vacío) y revisar los endpoints restantes (lead, secuencias) y la doc de route segment config.

### Claude

El manifest confirma que `middleware.ts` sí se ejecuta (deprecado pero funcional). No lo migraré a `proxy.ts` — eso está fuera de alcance y es riesgoso. La ruta `lead/[id]` no estaba donde esperaba; déjame ubicarla y ver el resto.

### Claude

Déjame usar las herramientas dedicadas en vez del grep en background.

### Claude

Ahora entiendo el panorama. La ruta `lead/[id]` no existe bajo whatsapp (la mencionó la tarea pero el set real son estos 7 endpoints). Antes de tocar la validación de `contactId`, déjame ver cómo el frontend consume estos endpoints, para no romper el flujo de lectura legítimo.

### Claude

El frontend lee vía `/thread` (convIds) y solo manda vía POST a `contacts/${sendContactId}/...`, donde `sendContactId` siempre viene del inbox WA. Mi validación pasará para todo envío legítimo. Déjame confirmar quién llama a las funciones de envío para decidir dónde poner el guard.

### Claude

Tengo el panorama completo. Resumen de hallazgos antes de editar:

- **Next 16.2.6**: `middleware.ts` está deprecado (renombrado a `proxy`) pero **sigue ejecutándose** (lo confirmé en el `middleware-manifest.json`). Lo mantengo como `middleware.ts` — migrar a `proxy` está fuera de alcance y es riesgoso. Lo anoto como observación.
- **El frontend** lee vía `/thread?ids=` (convIds) y solo envía vía `POST contacts/${sendContactId}/...`, donde `sendContactId` **siempre** sale del inbox WA. Mi validación de membresía no rompe ningún flujo legítimo.
- Las funciones `sendToContact`/`sendAttachmentToContact`/`sendTemplateToContact`/`getContactMessages` se llaman **solo** desde las dos rutas `contacts/[id]`. El motor de nutrición (`sendWhatsappTemplate`) usa otro camino (resuelve el contacto desde el teléfono server-side), así que no lo toco.

Voy a registrar las tareas y empezar por el fail-safe del middleware.

### Claude

El cambio de middleware no es observable en el preview (depende de env vars de producción), así que omito la verificación de browser per `<when_to_verify>` y lo valido con `tsc`/`eslint` como pediste. La tarea en background ya terminó (era exploración redundante).

Ahora el issue #2. Extiendo `contactConversaciones` para exponer `inboxId` y agrego el guard `contactoEnInboxWA`.

### Claude

Ahora cableo el guard en las dos rutas. Empiezo por `messages/route.ts` (GET + POST), con un helper local para no duplicar el manejo de error.

### Claude

Ahora la ruta de `attachments`:

### Claude

Ahora verifico con `tsc` y `eslint` como pediste.

### Claude

Ambos pasan limpio (exit 0). Déjame revisar el estado final de la ruta de mensajes para confirmar que el flujo POST quedó coherente, y correr el lint del proyecto completo por las dudas.

### Claude

Mis archivos pasan `eslint` limpio. El `npm run lint` global falla (exit 1) pero por errores **pre-existentes en el módulo de marketing** (`app/marketing/ResumenCreativos.tsx` y `page.tsx`) — nada que ver con mi cambio. Déjame confirmar el estado final de la ruta de attachments.

### Claude

Todo en su lugar. Voy a marcar el error de lint pre-existente del módulo de marketing como tarea aparte (es real y rompe `npm run lint`, pero es ajeno a este cambio de auth).

### Claude

Listo. Los dos issues de auth están corregidos y verificados.

## Lo que cambié

**1. Fail-safe del gate ([middleware.ts](middleware.ts))**

El gate ahora exige `DASHBOARD_PASSWORD` **y** `AUTH_COOKIE_VALUE`. Cuando falta alguna:
- **local/dev** (`NODE_ENV !== 'production'` y `VERCEL_ENV !== 'production'`) → no-op, igual que antes (no rompe el flujo sin Supabase/envs).
- **producción** → **fail-closed**: niega las rutas protegidas (401 para `/api/*`, redirect a `/login` para páginas) y loguea un `console.error` para que el operador note la env faltante.

Reordené para que las rutas **públicas** (webhooks/cron/login/beacon) se evalúen *antes* del chequeo de config, así el modo fail-closed nunca las bloquea (siguen con su propia auth por firma). Actualicé el comentario de cabecera, que describía el comportamiento viejo ("INACTIVO si falta la env").

**2. contactId arbitrario ([messages](app/api/whatsapp/contacts/[id]/messages/route.ts) + [attachments](app/api/whatsapp/contacts/[id]/attachments/route.ts))**

Agregué `contactoEnInboxWA(contactId)` en [lib/chatwoot.ts](lib/chatwoot.ts): valida server-side que el contacto tenga ≥1 conversación en `CHATWOOT_WA_INBOX_ID` (extendí `contactConversaciones` para exponer `inbox_id`). Es exactamente cómo el inbox de la app expone los contactos, así que ningún envío legítimo se rompe (el frontend manda con `sendContactId`, siempre del inbox WA). Si el contacto no pertenece al inbox → **403**; si el lookup falla → 500 (fail-closed, no envía). Lo apliqué al GET y POST de `messages` y al POST de `attachments`, **antes** de bufferear el multipart. El motor de nutrición (`sendWhatsappTemplate`) no se toca — resuelve el contacto desde el teléfono server-side, por otro camino.

## Verificación
- `npx tsc --noEmit` → **exit 0**
- `npx eslint` sobre los 4 archivos tocados → **exit 0, limpio**
- `npm run lint` global falla (exit 1), pero por **errores pre-existentes en `app/marketing/`** (un `react-hooks/set-state-in-effect` real), ajenos a este cambio. Lo dejé flageado como tarea aparte.

## Notas (fuera de alcance, no toqué)
- **`middleware` está deprecado en Next 16** (renombrado a `proxy`); tu `middleware.ts` **sigue ejecutándose** (lo confirmé en el `middleware-manifest.json`), por eso lo mantuve. Migrar a `proxy.ts` es un cambio aparte.
- **`thread/route.ts`** acepta `convIds` crudos y lee cualquier conversación de la cuenta (mismo patrón de lectura arbitraria, no de envío). No estaba en los dos issues que pediste; lo menciono por si querés cerrarlo después.
- Para contactos hipotéticos con conversaciones en **varios inboxes**, `crearOReusarConversacion` podría elegir una conversación de otro inbox al enviar. En esta cuenta (un solo inbox WA) es teórico; lo dejé como está para no tocar el camino compartido con nutrición.

