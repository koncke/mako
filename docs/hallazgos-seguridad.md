# Hallazgos de seguridad

Aislamiento entre inquilinos, credenciales y cifrado, firma de webhooks y superficie
expuesta. Lo que las auditorías encontraron y **no se puede deducir leyendo el código**.

Complementa a [auditoria-aislamiento-workspace.md](auditoria-aislamiento-workspace.md),
que es el mapa de qué se scopea por workspace y qué no. La regla que produce este
documento está en [AGENTS.md](../AGENTS.md) → «La cosecha».

⚠️ **Buena parte de lo de abajo es material de segunda mano**: sale de los journals de las
261 corridas multi-agente de junio a agosto de 2026 —134 de 260 nunca habían escrito nada
en el repo, el registro completo está en [corridas-multiagente.md](corridas-multiagente.md)—
y no de una relectura del código de hoy. Cada entrada dice de qué corrida y de qué fecha
viene. **Antes de actuar sobre una, verificá contra el código**: varias ya están
arregladas, y donde el rescate lo sabía, lo dice.

## Lo que más muerde acá

- Los guards que suenan a «solo la agencia» no lo son: tres de cuatro los pasa cualquier admin-cliente, y el único que cierra de verdad es `getSesionAdmin()` → [Guards, roles y sesión](#guards-roles-y-sesión).
- Cuando no hay cookie, el workspace efectivo es el del DUEÑO: por default del resolver y por 29 `?? OWNER_WS` escritos a mano en 19 libs → [Aislamiento multi-inquilino](#aislamiento-multi-inquilino).
- `getTenantDb()` sobre una tabla que nadie registró no filtra nada y no avisa: el call-site cree estar aislado → [Aislamiento multi-inquilino](#aislamiento-multi-inquilino).
- Tres secretos de webhook son de plataforma y se los repartimos a los clientes (Chatwoot se lo escribe adentro de SU panel, Calendly se lo pide el tutorial, Evolution viajaba en un JSON) → [Webhooks y firmas](#webhooks-y-firmas).
- La migración de cifrado tiene tres verdes que no prueban nada y un paso irreversible cuyo backup está comentado → [Credenciales y cifrado](#credenciales-y-cifrado).
- Una ruta de API que termina en `.png` queda fuera del gate, y meter un prefijo en `PUBLICOS` saca más cosas de las que parece → [Superficie expuesta](#superficie-expuesta).

---

## Aislamiento multi-inquilino

La regla del dueño, textual: «los Workspace JAMÁS deberían compartir información con
otros. Deberíamos hacer una auditoría para que esto no pase en ningún lugar» (2026-07-05).
Un cruce no se trata como bug de UI: es ciberseguridad, y el arreglo viene con el barrido
de todos los lugares donde el mismo patrón puede repetirse.

### ⚠️ `getTenantDb()` sobre una tabla que no está en TENANT_TABLES no filtra NADA (y no avisa)

El proxy es fail-open: `if (!TENANT_TABLES.has(table)) return builder` (lib/workspace.ts:179).
Una tabla nueva por-cliente que el dev olvide registrar queda global y en silencio, y
peor: el call-site que usa `getTenantDb()` cree estar aislado. El caso medido fue
lib/meta-health-history.ts, que usa `getTenantDb()` sobre una tabla fuera del set —
`getHistorialMeta()` devuelve el historial de TODOS los workspaces. **La regla: usar
`getTenantDb()` NO es evidencia de aislamiento**; hay que verificar que la tabla esté en
el Set Y tenga la columna. Sigue vivo hoy (verificado en lib/workspace.ts:179).

**Vive en:** lib/workspace.ts:179 (scopedFrom) · lib/meta-health-history.ts · *2026-07-02 · ~auditoria-seguridad-rutas-108*

### ⚠️ Sin cookie el workspace efectivo es el del DUEÑO — por default del resolver y por 29 `?? OWNER_WS` escritos a mano

`resolverDesdeCookies` devuelve OWNER_WS cuando no hay cookie (lib/workspace.ts:75-81,
pensado para crons y webhooks) y `getTenantDb` scopea con eso. Además, 29 ocurrencias en
19 libs repiten el fallback explícito `const ws = (await getWorkspaceActual()) ?? OWNER_WS`,
que deshace el fail-closed del proxy tenant (`getWorkspaceActual()` devuelve null y el
proxy usa id -1 → cero filas).

Dos efectos medidos: (1) un admin de agencia SIN workspace propio que abre
`/plan/revisar/<id>` entra por ese fallback y LEE el borrador de Mauricio en vez de ver el
cartel de «no es tuyo»; (2) una página o route público que lea una tabla tenant anda
perfecto hoy —porque el contenido ES del dueño— y el día que un cliente comparta lo suyo
sirve el material de la agencia. El converso también rompe: si el visitante SÍ tiene
cookie, devuelve SU workspace.

La distinción que falta es entre «no hay sesión» (cron → dueño, legítimo) y «hay sesión
pero no resuelve workspace» (admin neutro, sesión revocada → tiene que fallar cerrado).
Regla: **en todo lo público el workspace sale de la FILA** (el token/share/routing), nunca
del request, y todo el trabajo va dentro de `runWithWorkspace(ws, …)` como hace
app/api/onboarding/archivero/route.ts:78,92,135. Corolario: probarlo en local no prueba
nada — sin `gateConfigurado()` y fuera de producción, lib/auth.ts:62-66 te devuelve admin
de ws1. Es la trampa a cerrar antes de darle a MaKo cualquier capacidad de ejecutar sola.

**Vive en:** lib/workspace.ts:75-81 (resolverDesdeCookies / getTenantDb) · lib/plan-propuesta.ts:24, lib/settings.ts:17, lib/plan-board.ts:27, lib/credenciales.ts:110, lib/leads.ts:1341 (+24 más) · *2026-07-27 branding-mako-conocimientos · 2026-08-05 ronda-clientes-y-automatizacion*

### ⚠️ Las vistas v_cohortes_* siguen abiertas al rol anon: la migración 0118 no las pudo cerrar

La mig 0118 cerró las 15 tablas abiertas a `anon` y se dio por resuelto el agujero. Pero
`alter table ... enable row level security` NO se puede aplicar a una VISTA, y las dos
vistas de cohortes quedaron afuera. Peor: `v_cohortes_mensuales` y `v_cohortes_semanales`
son OWNED BY postgres y SIN `security_invoker`, así que corren con los privilegios de su
dueño — y como `leads` tiene `relforcerowsecurity=false`, el dueño bypassa su propio RLS.
Medido contra prod con la clave anon: 13 y 36 filas con `workspace_id` de 3 workspaces,
con J1 por cohorte, asistencias, cierres, ciclo promedio y US$80.780 de ingreso agregado.
O sea que el RLS de `leads` es real para la tabla e inútil a través de las vistas. Falta
`revoke all on v_cohortes_mensuales, v_cohortes_semanales from anon, authenticated`
(+ opcionalmente `set (security_invoker = on)`, que no rompe nada porque la app las lee
con service_role). Del mismo barrido: `storage.objects`/`storage.buckets` sí están
cerrados (RLS on + 0 policies).

**Vive en:** supabase/migrations/0118_rls_tablas_abiertas.sql (no las toca) · vistas creadas en 0001 y redefinidas en 0084_cohortes_workspace.sql · lectura de la app en lib/queries.ts · *2026-08-05 ronda-clientes-y-automatizacion*

### ⚠️ `notificaciones` y `meta_campaign_drafts` NUNCA recibieron workspace_id

`listNotificaciones()` hace un select sin ningún filtro de workspace y la tabla (mig 0048)
no tiene la columna — ni en la 0054 ni después. Consecuencia concreta: la campanita de un
cliente impersonado muestra los reportes, alertas de semáforo, wins y aprobaciones de
plantilla del dueño, con títulos, descripción y `entity_id` de leads ajenos. Lo mismo con
`meta_campaign_drafts` (mig 0045). Además bloquea el reset de workspace: no se pueden
vaciar por cliente, así que «arranca completamente vacío» es falso por dos tablas.
Encontrado el 2026-07-02 y todavía abierto el 2026-08-01; verificado: cero ocurrencias de
`workspace_id` en lib/notificaciones.ts.

**Vive en:** lib/notificaciones.ts · supabase/migrations/0048 y 0045 · lib/reset-workspace.ts · *2026-08-01 · mako-cliente-prueba-diagnostico*

### ⚠️ META_PAGE_ID está hardcodeado con la página de Mauricio en todas las escrituras de Ads Manager

`lib/config.ts:46` exporta `META_PAGE_ID = '282881742134130'` (la página de Facebook de
Mauricio) y `lib/meta-ads-create.ts` la usa SIN scopear por workspace en la creación de
creativos, audiencias, targeting y en el listado de `leadgen_forms`; de ahí cuelgan ~10
rutas (campaign-create, ad-add, ad-edit, adset-add, adset-targeting, audience-create…).
Un cliente que cree una campaña desde Ads Manager publica con la página de Mauricio y ve
los formularios de Mauricio. La lectura de Ads Manager es el mejor wow del día 1; el eje
de ESCRITURA está cross-tenant. Sigue así hoy — el propio código lo avisa en un comentario
(«hay que recablear META_PAGE_ID/token a credWs por workspace, tarea #170»), pero eso no
es un documento y no lo lee nadie antes de abrirle la tab a un cliente.

**Vive en:** lib/config.ts:46; lib/meta-ads-create.ts:97, :194, :233, :246, :265, :312, :365, :368 · *2026-07-16 · mako-onboarding-solo-meta*

### ⚠️ El escape `manual` se resuelve antes de ramificar por acción: 'cargar' escribe en el plan de otro workspace

En `/api/plan-reunion` el `invitado` —con el bypass `manual` que saltea la lista blanca de
participantes de la grabación— se calcula ANTES del `if (action === 'cargar')`. El bypass
se diseñó para 'enviar' (mandar un mail o un WhatsApp a una dirección tipeada: el riesgo
máximo es spam), pero alcanza igual a 'cargar', que crea una `plan_propuestas` pendiente
en el workspace del destinatario. Ninguna pantalla manda hoy `manual` con `cargar`, así
que no se ve: cualquier usuario logueado puede hacer
`POST {action:'cargar', manual:true, email:<cualquier usuario registrado>}` y dejarle un
borrador en el plan de otro inquilino. Lo encontraron dos verificadores adversariales por
separado, refutando otro hallazgo. El fix es mover el fallback `manual` adentro de la rama
'enviar'.

**Vive en:** app/api/plan-reunion/route.ts:107-127 · *2026-08-01 dedup-y-envio-a-mi-plan*

### ⚠️ Impersonar cierra el eje de datos pero NO el eje de agencia

El síntoma reportado fue «el Cliente de Prueba ve cosas que no debería» y el primer
diagnóstico apuntó al guard de onboarding — era el equivocado. La causa real:
`esDuenoAdmin()` devuelve true por el solo hecho de ser admin de la app, impersone o no
(lib/workspace.ts:118-121), así que los guards de plata de la agencia siguen abiertos
dentro de la vista del cliente (lib/ads-guard.ts, /api/meta-write,
/api/ads-manager/campaign-create). Y el filtro del menú de perfil del Sidebar es
`!it.adminOnly || rol === 'admin'` SIN mirar `impersonando`, mientras que el shell
principal sí lo mira (`adminShell = rol==='admin' && !impersonando`): «Contexto de MaKo» y
«Admin» quedan visibles y clickeables desde adentro del cliente.

El dueño lo pidió como fidelidad, no como estética: «Con el usuario de prueba no debería
ver mi foto de perfil… Y tampoco las tabs que no están disponibles en los usuarios y solo
en super admin» (2026-08-01). Y la regla que gobierna cualquier fix acá: la vista de super
admin y la del cliente son la MISMA pantalla, todo cambio se lleva a las dos en la misma
pasada («no entiendo porque la vista de superadmin y cliente son diferentes en la tab de
Plan, deben ser lo mismo», 2026-07-13).

**Vive en:** lib/workspace.ts:118 (esDuenoAdmin) · app/_components/Sidebar.tsx (filtro de USER_NAV) · lib/ads-guard.ts · *2026-08-01 · mako-cliente-prueba-diagnostico*

### ⚠️ Sin verificar: MaKo en los grupos de WhatsApp con clientes puede traer datos de otro workspace

Pedido abierto del dueño, todavía sin auditar: en el grupo de PRUEBAS MaKo sí trae datos
cruzados, y falta comprobar que en los grupos con CLIENTES no pase lo mismo. «recuerda la
estructura y ciberseguridad. Es importante eso!» (2026-07-15). El camino a revisar es el
mismo de siempre: qué workspace resuelve el handler de entrada y si todo el trabajo corre
dentro de `runWithWorkspace`.

**Vive en:** el camino de entrada de WhatsApp (mako-doer-in) y las tools tenant-scoped · *pedido 2026-07-15, sin corrida asociada*

### Se elimina OWNER_WS como destino de eventos: cada webhook resuelve el workspace real

Decisión del dueño el 2026-07-16: «ningún evento debe dispararse por error y confundirlo
con el workspace de otro cliente. Hay que mapear urgente». Es el paraguas de casi todo lo
de arriba y de la sección de [Webhooks y firmas](#webhooks-y-firmas): el fallback a
OWNER_WS deja de ser un default aceptable salvo para crons declarados.

### Resend y /api/email/unsubscribe son GLOBALES a propósito: confinarlos rompe a los clientes

Una auditoría de aislamiento los marca como leak porque usan `getSupabaseServer` crudo
sobre `leads`, pero es por diseño: `marcarEventoEmail`/`suprimirPorRebote` matchean por un
proveedor_id globalmente único y después actualizan el lead exacto por PK; unsubscribe es
un update por PK gateado por un HMAC por-lead. Confinarlos a OWNER_WS rompería la
supresión por rebote y la baja de los clientes. **No volver a «arreglarlo».** En la misma
pasada se verificó que fathom/meta-leads/calendly ya acceden a leads solo por lib/leads
(getTenantDb) y resuelven a OWNER_WS por el fallback sin cookie: envolverlos en
`runWithWorkspace(OWNER_WS)` es defensa en profundidad, no un fix de fuga.

**Vive en:** lib/email-marketing.ts (marcarEventoEmail, suprimirPorRebote) · app/api/email/unsubscribe/route.ts · *2026-07-13 · plan-autonomo-tanda2*

---

### ⚠️ El botón de vaciar un workspace se ofrecía en TODOS los clientes reales

**Síntoma:** ninguno, hasta que alguien lo apretara. Martín lo vio en la interfaz: los
controles de agencia («Datos de Mauricio» y **Reset**) aparecían parado adentro de
cualquier cliente.

**Causa:** el guard era una condición **negativa**. Tres capas, y las tres decían lo mismo:

```ts
if (ws == null || ws === OWNER_WS) return null;   // ← "cualquiera menos el dueño"
```

Eso protege a Mauricio y **a nadie más**. Leandro (ws 10), Martín (9) y Leila (11) tenían
el botón de vaciar disponible, y `resetearWorkspace` borra 50+ tablas y 4 buckets de
storage sin vuelta atrás. La función que decidía se llamaba `wsDePrueba()` — el nombre
decía la intención, el código decía otra cosa, y nadie lo miró dos veces porque leyendo el
nombre parecía correcto.

**Regla: un guard sobre algo destructivo se escribe en POSITIVO.** «Solo ESTE» y no
«cualquiera menos aquél». La lista de lo que hay que proteger crece sola con cada cliente
nuevo; la de lo que se puede tocar, no. Una condición negativa se queda vieja el día que
se da de alta un cliente, y sin que nada avise.

Dos corolarios del mismo arreglo:

- **La condición se sacó a un módulo sin `server-only`** (`exigirClienteDePrueba` en
  `lib/auth-session.ts`). No es prolijidad: `lib/reset-workspace.ts` lleva `server-only`,
  así que un test **no lo puede importar** — la guarda más peligrosa de la app era la única
  sin red. Ahora tiene `tests/reset-workspace.test.ts`.
- **Esconder el botón no es el arreglo.** El que decide es el endpoint; la UI se pinta con
  lo que él contesta. Si sólo se ocultara el botón, un POST a mano seguiría vaciando.

**Vive en:** lib/auth-session.ts (`WS_PRUEBA`, `exigirClienteDePrueba`) · app/api/datos-mau/route.ts (`wsDePrueba`) · lib/reset-workspace.ts · app/_components/PanelAgencia.tsx · *2026-08-08*

## Guards, roles y sesión

### ⚠️ Ningún guard que mire el eje de workspace puede restringir a la agencia: el único que sirve es `getSesionAdmin()`

Tres guards con nombre de «solo la agencia» y ninguno lo cumple, por la misma razón de
fondo: miran el eje del workspace (`rol_ws`, dueño, workspace actual) y ese eje es
incapaz por diseño de separar a la agencia de un cliente.

1. **`esWorkspaceDueno()` no significa «es el dueño»: lo pasa cualquier closer o setter del
   ws1.** El gate de `/api/anthropic-usage` se apoyaba solo en eso. Como el toast de gasto
   está montado en el layout y corre en todas las páginas, un closer/setter del ws1 recibía
   el historial completo de las últimas 80 operaciones de IA de toda la agencia — y
   `recordUsage` siempre inserta contra OWNER_WS, así que ese historial mezcla ops de todos
   los clientes e incluye el campo `motivo`, que lleva recortes del mensaje de WhatsApp que
   las disparó. La página sí lo bloqueaba; la API no. Ya corregido en
   app/api/anthropic-usage/route.ts:20 — falta revisar todo otro gate que lo use.
2. **`esDuenoAdmin()` NO quiere decir «solo el dueño»: el ws 1 es Mauricio, que es un
   cliente.** Un informe proponía cerrar el editor de prompts cambiando el guard a
   `esDuenoAdmin()`. Una sonda a la tabla `workspaces` lo refutó: `OWNER_WS = 1` y el
   workspace 1 es «Mauricio Bustos», un cliente más (lo dice el propio app/plan/page.tsx).
   Como `esDuenoAdmin()` = `getSesionAdmin() || (ws === OWNER_WS && rol_ws === 'admin')`,
   ese cambio deja pasar igual al cliente más grande. Corrección a la mecánica que circula:
   la causa del leak NO es el backfill de `rol_ws` null — medido, los 5 usuarios no-admin
   tienen `rol_ws` literalmente 'admin' en la base, porque el producto le da `rol_ws='admin'`
   al dueño de CADA workspace cliente.
3. **`requireRolWs([])` no significa «solo SuperAdmin», significa «solo admin-cliente».**
   Y el admin-cliente de cada workspace lo pasa siempre, porque tab-access.ts:42 deja pasar
   `rol === 'admin'` y workspace.ts:119 devuelve `sesion.rolWs ?? 'admin'`. Encima es
   fail-OPEN si `rol` viene null. Por eso `/conocimiento` «parece» protegido y expone a
   todo admin-cliente el catálogo de metodología de la agencia.

Regla: si la ruta es de la agencia se cierra con `getSesionAdmin()`, el único que mira el
eje global. Las rutas que sí lo usan (/contexto, /agencia, /metodo, /modelos-ia, /admin)
aguantaron la auditoría.

**Vive en:** lib/workspace.ts:118 (esDuenoAdmin) y :119 · lib/auth.ts:76 (getSesionAdmin) · lib/auth-session.ts:47 (OWNER_WS) · lib/tab-access.ts:42 · app/api/anthropic-usage/route.ts:20 · todos los call-sites de requireRolWs (app/conocimiento, etc.) · *2026-07-15 ~review-toast-gasto-ia · 2026-07-16 mako-auditoria-rutas-byok · 2026-08-05 cierre-ronda-mako*

### ⚠️ Suspender a alguien no lo saca: la revocación es fail-open

`getUsuarioActual` consulta la base para chequear el estado del usuario, pero si esa
consulta falla devuelve la sesión firmada tal cual, para no desloguear a todos ante una
caída. O sea: durante una caída transitoria de Supabase, un usuario suspendido sigue
entrando. Sumado a eso, el proxy/middleware valida el token solo con criptografía sin
tocar la base, así que la cookie de un suspendido es válida a nivel borde hasta 30 días —
el corte real recién ocurre en la capa de página/datos. Y un usuario-cliente con `rol_ws`
en NULL se resuelve como **admin efectivo** por el backfill: el rol restrictivo hay que
asignarlo explícito, no se asume.

**Vive en:** lib/auth.ts:49-51 · el proxy/middleware · app/_components/nav.ts (rolesWs) · *2026-07-19 ~landing-24-features-auditoria*

### ⚠️ Un admin «invitado» que nunca entró cuenta como admin activo y deja al cliente sin nadie

`contarAdminsClienteActivos` cuenta con `.neq('estado','suspendido')`, y un usuario recién
creado nace en estado `invitado`. Entonces el único admin real de un workspace invita a
alguien con `rol_ws` admin, el contador pasa a 2, y a partir de ahí el guard «no dejar al
cliente sin admin» lo autoriza a auto-suspenderse, degradarse o eliminarse. Si el invitado
nunca inicia sesión, el workspace queda con cero admins funcionales y nadie puede
gestionar el equipo por `/api/equipo` (exige rol_ws admin). Mismo defecto en
`contarAdminsActivos` para la agencia. Regla: un contador que gobierna un invariante de
«no te quedes sin X» tiene que contar los que PUEDEN operar hoy, no los que no están
suspendidos — `estado === 'activo'`, no `!== 'suspendido'`.

**Vive en:** lib/usuarios.ts:184-190 y :213-219 · app/api/equipo/route.ts · app/api/admin/usuarios/route.ts · *2026-07-02 ~auditoria-acceso-roles*

### Se elimina AUTH_COOKIE_VALUE: el único acceso es login con Google

Decisión del dueño del 2026-07-17, para cerrar el acceso compartido. Ojo con el orden:
`AUTH_COOKIE_VALUE` **es la llave de derivación del cifrado v1** de credenciales, así que
retirarla es un paso del runbook de migración —después del backfill y con todos los
escritores contemplados—, no un borrado de env var. Ver
[Credenciales y cifrado](#credenciales-y-cifrado).

### El campo del Archivero solo lo edita un SUPER ADMIN

Decisión del 2026-07-26: no cualquier usuario del workspace. Es el contexto del que come
toda la IA del workspace, así que quien lo edita mueve el comportamiento de MaKo para todo
el equipo del cliente. Guard correcto: `getSesionAdmin()`.

---

## Credenciales y cifrado

Las credenciales viven **por workspace en /integraciones**, no como env vars de Vercel
(decisión del 2026-07-17: «Cada cliente tendrá sus propias API… creo que va a ser un gran
problema» manejarlo en Vercel). Al ver una key: click = copiar (no editar), se oculta sola
a los pocos segundos y al navegar fuera. Y la línea que no se cruza en la UI: **nunca
decir que el equipo de MaKo puede ver las credenciales del cliente** — «¿Cómo hacemos para
que sea BYOK?» (2026-07-16). Si el modelo lo permite, se resuelve como BYOK real, no con
un texto que lo justifique.

### ⚠️ El super admin no puede ver una credencial propia

Sale «Solo el admin de este espacio puede ver una credencial» cuando la credencial es
suya. Pedido explícito y sin cerrar: «Revisalo y solucionalo, debo poder ver eso»
(2026-07-30). Sospechoso número uno: un guard del eje workspace donde debería estar
`getSesionAdmin()` (ver [Guards, roles y sesión](#guards-roles-y-sesión)).

**Vive en:** la ruta de lectura de credenciales de /integraciones · *pedido 2026-07-30, sin corrida asociada*

### ⚠️ El backfill de cifrado declara terminada la migración mirando UNA sola tabla

`cifrar()` tiene dos escritores, no uno: `guardarCredencial` → tabla `credenciales`, y
`cifrarSecreto` (único caller: lib/google-calendar.ts:52) → `app_settings`, key
'google.calendar.refresh_token'. El script de backfill lee y re-cuenta SOLO `credenciales`,
y el runbook verifica con el mismo SQL — grep del doc entero por
`calendar|app_settings|refresh_token`: cero matches. Entonces imprime «✅ Listo. Recién
ahora se puede retirar la rama v1 y rotar AUTH_COOKIE_VALUE» con una fila gcm1 viva
afuera, y el paso 4 la mata: Google emite el refresh_token una sola vez, así que es
irrecuperable sin reconectar a mano. Regla: **el criterio de «terminó la migración» tiene
que salir de todos los escritores de la función**, no de la tabla donde vive la mayoría.

**Vive en:** scripts/recifrar-credenciales.mjs:31 y :94 · docs/migracion-cifrado-credenciales.md:104-115 · lib/google-calendar.ts:52 · *2026-07-16 ~auditoria-migracion-cifrado-credenciales*

### ⚠️ El runbook de cifrado tiene tres verdes que no prueban nada

(1) El «cinturón» del backfill re-descifra lo que acaba de cifrar EN EL MISMO PROCESO y
con la misma clave: va y vuelve por construcción, así que no puede detectar que el
`CREDENCIALES_SECRET` de .env.local (que hay que pegar a mano, no está ahí) sea distinto
del de Vercel — y el UPDATE pisa el gcm1 original sin ninguna columna que lo preserve.
(2) El verify da verde en falso con 0 filas gcm1 y N ilegibles: `porVersion.gcm1` es
`undefined` → falsy → rama verde, y el `process.exit(0)` corre ANTES del abort por
ilegibles; también dispara si falta el secreto, porque eso se chequea después. (3) La
única red del único paso irreversible —el backup— está comentada, dentro de un fence
marcado como `bash` y con `YYYYMMDD` literal: copiar y pegar el bloque ejecuta solo el
`openssl` y el backup no ocurre, sin error (y `#` tampoco es comentario en Postgres). El
propio doc usa un fence `sql` tres líneas después, así que no es convención floja.

**Vive en:** scripts/recifrar-credenciales.mjs:53-96 · docs/migracion-cifrado-credenciales.md:45-51 · *2026-07-16 ~auditoria-migracion-cifrado-credenciales*

### ⚠️ Una fila etiquetada gcm1 pero cifrada con otro secreto nunca abre, y es indistinguible de una v1 legítima

El código viejo derivaba la clave por la cascada
`CREDENCIALES_SECRET || AUTH_COOKIE_VALUE || SERVICE_ROLE_KEY` pero escribía con prefijo
`gcm1.`; el lector nuevo tiene `claveV1()` congelada a `AUTH_COOKIE_VALUE || SERVICE_ROLE_KEY`
y jamás mira CREDENCIALES_SECRET. Una fila escrita con el secreto puesto queda etiquetada
gcm1 y cifrada con otra clave: el authTag falla, devuelve null para siempre, y ningún
código puede separarla de una v1 buena (mismo prefijo, misma forma). Sacar el secreto del
env tampoco la recupera. Arrastre: el backfill aborta COMPLETO si detecta ilegibles, así
que una sola fila así bloquea la migración de todas las demás. Regla: **la etiqueta de
versión tiene que identificar la DERIVACIÓN de clave**, no solo el formato del criptograma.

**Vive en:** lib/cripto-credenciales.ts:38-42 y :115 · scripts/recifrar-credenciales.mjs:69-73 · *2026-07-16 ~auditoria-migracion-cifrado-credenciales*

### ⚠️ Dos filos del módulo de cripto que no se ven desde ninguna pantalla

(1) `escribeV2()` hace `process.env.CREDENCIALES_V2 === '1'` SIN trim, mientras
`secretoV2()` sí trimea el secreto: ' 1', '1\n', 'true', 'yes' hacen que el flag falle
ABIERTO hacia v1 y se sigan escribiendo gcm1 en silencio. Y `=== '1'` no es la convención
de la casa (el otro flag booleano del repo usa `=== 'true'`). Nada expone la versión de
escritura: `estadoCampo()` devuelve `{configurado, origen, mask, ilegible}` y no incluye el
formato, así que ni el modal puede mostrarlo. (2) `descifrar` hace `setAuthTag` sin validar
el largo: reproducido en Node, un tag truncado a 4 bytes se acepta — downgrade real de 128
a 32 bits (el propio runtime lo marca con DEP0182). (3) No hay canario, huella ni `kid` en
ninguna parte: `catch { return null }` sin log es toda la señal que da un secreto rotado.

**Vive en:** lib/cripto-credenciales.ts:47 vs :63, :106-121, :125-127 · *2026-07-16 ~auditoria-migracion-cifrado-credenciales*

### ⚠️ «Google Calendar: conectada» solo comprueba que el string no esté vacío

`googleCalendarConectado()` es `!!(await getSetting(TOKEN_KEY))?.trim()` — nunca llama a
`descifrarSecreto`. Si el token quedó ilegible (secreto rotado, formato viejo), el semáforo
sigue verde y encima con nombre y apellido, porque el email se guarda EN CLARO y sobrevive
al fallo de cifrado. Río abajo, `accessTokenGoogle()` devuelve null sin un log que
distinga «no hay token» de «no lo puedo abrir», `buscarEventosGoogle()` devuelve `[]`
(«silencioso: nunca debe romper el flujo») y el síntoma aparece a tres módulos de
distancia: el CRM automático reporta «falta la fecha de la R1». Regla: **un chequeo de
conexión que no ejercita la credencial no es un chequeo de conexión.**

**Vive en:** lib/google-calendar.ts:83-93 y :116 · lib/integraciones.ts:77 · lib/auto-reuniones.ts:126 · *2026-07-16 ~auditoria-migracion-cifrado-credenciales*

### ⚠️ `credWs` sin workspace cae al dueño en silencio — la regla fail-closed la cumple Evolution, no el helper que todos usan

El mapa del proyecto dice «caer a OWNER_WS no es un default benigno», pero el resolver de
credenciales hace exactamente eso: `wsDefault()` es
`ws ?? getWorkspaceActual() ?? OWNER_WS`. Cualquier código que llame a una lib de
integración FUERA de un `runWithWorkspace` o de una sesión (un script, un cron nuevo, un
handler que se olvidó de envolver) le va a hablar al Chatwoot / al Meta del dueño sin
avisar. Hoy no hay explotación porque los consumidores reales entran por `runWithWorkspace`
y `/whatsapp` se corta antes con `integracionConectada()` (que a propósito NO colapsa a
OWNER_WS), pero es un filo expuesto para el próximo call-site. El patrón correcto está a la
vista en Evolution: `wsEstricto()` TIRA cuando no hay workspace, con el comentario «nunca
operar sobre la instancia del dueño por un fallback silencioso». Falta una variante
estricta de `credWs` para las libs de integración.

**Vive en:** lib/credenciales.ts:110 (wsDefault) y :129-132 (credWs) vs lib/evolution.ts:18-22 (wsEstricto) · *2026-08-05 · ~auditoria-ruleta-hidratacion-credenciales*

### Federar el guard sin federar la credencial convierte el guard en la puerta de entrada

Cinco rutas cambiaron su gate de `esWorkspaceDueno()` a `integracionConectada()`, que
resuelve por-workspace vía `credWs`. Pero el fetch de abajo siguió leyendo
`process.env.META_ACCESS_TOKEN` / `META_AD_ACCOUNT_ID` (y `CHATWOOT_BASE_URL`), que son
SIEMPRE los del dueño porque la hidratación al env global es solo del ws1. Efecto: un
cliente que conecta su propio Meta pasa el guard con SUS credenciales y recibe los
desgloses, las recomendaciones y el `opportunity_score` de la cuenta publicitaria del
DUEÑO. Antes del cambio el mismo cliente no pasaba el gate y veía un vacío benigno:
federar la mitad de la ruta la volvió **peor que antes**. La regla: el gate y la fuente de
datos se federan en el MISMO commit; si un guard pasa a ser por-workspace, toda credencial
de esa ruta pasa por `credWs` (solo la config global —META_API_VERSION— se queda en
process.env).

**Vive en:** app/api/account-insights/route.ts · app/api/meta-recommendations/route.ts · app/api/ad-insights/route.ts · app/api/entity-insights/route.ts · app/api/whatsapp/file/route.ts (los cinco ya federados) · *2026-07-01 · ~auditar-federacion-credenciales*

### `hidratarCredenciales` no filtra por catálogo: filas viejas pisan el entorno en cada boot

El login de la plataforma colgaba de dos filas zombie de GOOGLE_CLIENT_ID/SECRET guardadas
en `credenciales` que ninguna UI mostraba y que `hidratarCredenciales` copiaba sobre el
`process.env` en cada arranque. Como no filtra por el catálogo, cualquier fila vieja del
dueño puede volver a pisar el entorno en el próximo boot, y el síntoma aparece lejos de la
causa: una integración de plataforma que deja de funcionar sin que nadie haya tocado
Vercel. Regla: la hidratación acepta solo las claves del catálogo, e `INFRA_ENV` protege
las de plataforma. Trampa hermana del mismo frente: **un backup anterior al 2026-07-16
tiene credenciales en formato gcm1 que YA NO ABREN**, porque se eliminó la rama v1 del
cifrado — restaurarlo no devuelve las integraciones.

**Vive en:** lib/credenciales.ts (hidratarCredenciales, migrarEnvACredenciales) · lib/cripto-credenciales.ts · *2026-07-17 ~reconciliar-lote-de-commits-con-el-plan*

### Operar en prod: no toques credenciales que no son del workspace en el que estás

Pasó de verdad: una pasada desconectó todas las keys de Mauricio mientras trabajaba en
otra cosa («Me desconectaste todas las otras key de Mauricio… vuelvelas a poner»,
2026-07-23). Reglas que quedan: (a) el alcance del cambio es el workspace de la tarea, no
la tabla entera; (b) con el ws1 se comparten SOLO dos credenciales —la API de Claude y
Panda Video— y nada más, porque su historial y su saldo de Gemini aparecían mezclados con
los del super admin; (c) todo lo que salga hacia afuera durante una prueba va a
martinkoncke@gmail.com y +5493764673479, nunca a un contacto real del CRM.

**Vive en:** /integraciones y lib/credenciales.ts · *decisiones del dueño 2026-07-14 / 2026-07-23*

### Pendiente: decir en cada pedido de API que el método es BYOK

En todo lugar donde la app pide una key falta la aclaración de que la credencial es del
cliente y qué la protege (pedido del 2026-07-15). Está atado a la regla de arriba: si el
texto tuviera que admitir que la agencia puede leerla, el que se cambia es el mecanismo,
no el texto.

---

## Webhooks y firmas

Tres secretos de webhook son de plataforma —uno para todos los inquilinos— y el producto
se los reparte a los clientes. Es el mismo defecto tres veces, y por eso van juntos.

### ⚠️ El secreto del webhook de Chatwoot es de plataforma y la app se lo escribe al cliente adentro de SU Chatwoot

`CHATWOOT_WEBHOOK_SECRET` es un bearer casero (Chatwoot no firma nada) y hay uno solo para
todos los workspaces. `repararWebhookChatwoot` registra en la cuenta de Chatwoot DEL
CLIENTE la URL `…/api/webhooks/chatwoot?secret=<secreto de plataforma>`, así que el admin
de cualquier workspace lo lee en Settings → Integrations → Webhooks. Con ese valor puede
POSTear un payload con el `account.id` de otro inquilino (son enteros chicos, enumerables)
y el receptor resuelve el workspace LEYENDO EL PAYLOAD: pausa nutriciones ajenas, pisa
`pipeline_stage` a 'manual' y dispara avisos en el CRM de otro cliente. Acá no hay huevo y
gallina: como es un bearer y no una firma sobre el cuerpo, **el secreto PUEDE ser la llave
de ruteo** (token por workspace en la URL → lookup token→ws por hash → recién ahí exigir
que el account_id coincida). Sigue vivo.

**Vive en:** app/api/webhooks/chatwoot/route.ts:78 y :117 · lib/chatwoot.ts:686 (chatwootWebhookUrl) · *2026-08-05 ~review-commit-firma-webhooks (ya detectado el 2026-07-16 en ~auditoria-env-vars)*

### ⚠️ La forja cross-tenant de Calendly NO está cerrada: la «key propia» del ws1 es el secreto de plataforma

El commit que puso firma por workspace es el refactor correcto, pero no cierra nada
todavía: la fila `CALENDLY_WEBHOOK_SIGNING_KEY` del ws1 tiene `updated_by='migracion-env'`,
o sea que ES una copia del env de plataforma, y `webhook_routing` solo tiene dos filas de
calendly, las dos del ws1. Peor: el tutorial del catálogo le dice textual al cliente que si
el webhook lo configuró la agencia le pida la signing key a quien lo creó — el producto
reparte el valor que después usa para autenticar. Con esa key cualquiera firma un POST con
el nombre del event type (que está en la página pública de reservas) y escribe un lead
falso, fecha de R1, evento Schedule al píxel y enrolamiento de nutrición en el CRM de la
agencia. Falta la parte operativa, en este orden: (1) generar signing key nueva y única
para ws1 y recrear la suscripción, (2) borrar la var del env de Vercel para que `envCred`
devuelva null y el receptor quede fail-closed, (3) reescribir el paso del catálogo para
que nadie reutilice la key de la agencia, (4) borrar las filas copiadas a ws3. Para Fathom
en cambio el arreglo ya cobra: ws9 y ws11 tienen secreto propio y pasaron de 401 permanente
con la UI en verde a validar.

**Vive en:** app/api/webhooks/calendly/route.ts:121 (`keyWs ?? envCred(...)`) · lib/metodo-catalogo.ts:711 · *2026-08-05 ~review-commit-firma-webhooks*

### ⚠️ Un secreto en un query param viaja al browser aunque la UI no lo pinte

`webhookUrl()` mete el `EVOLUTION_WEBHOOK_SECRET` —compartido por TODOS los clientes— en
la query de la URL, y `estadoWebhook()` devolvía esa URL entera en `urlActual`/`urlEsperada`.
El guard de la ruta es «admin del workspace» = cualquier cliente, así que un admin de
cliente mandaba `action:'webhook-estado'` y se llevaba el secreto con el que se forjan
webhooks de cualquier otro workspace (mensajes de WhatsApp inventados en el CRM ajeno). Lo
más feo: la UI solo lee el campo `estado`, así que el secreto viajaba sin que nadie lo
mirara. Regla: **lo que se devuelve en un JSON es público para el que abre las devtools** —
recortar la query antes de devolver una URL y nunca poner ahí un secreto compartido entre
inquilinos. Del mismo barrido: el logout no limpiaba la cookie de impersonación (`mako_ws`,
12h), así que volver a entrar te dejaba adentro del workspace del cliente.

**Vive en:** lib/evolution.ts (webhookUrl, estadoWebhook) · app/api/whatsapp/evolution/route.ts · *2026-07-17 ~reconciliar-lote-de-commits-con-el-plan*

### El código de respuesta de un webhook delataba la cartera de clientes

Resolver el workspace ANTES de verificar la firma convierte el status en un oráculo: un
email de cliente real devolvía 401 y uno inventado 200. Cualquiera enumera quién está dado
de alta sin tener ninguna credencial. Medido en producción. Regla: **verificar la firma
SIEMPRE** —también en el camino donde no se pudo resolver el ruteo— y recién después
devolver el «ignorado». Aplica a cualquier receptor nuevo con secreto por-cliente.

**Vive en:** app/api/webhooks/fathom · app/api/webhooks/calendly · lib/webhook-routing.ts · *2026-08-07 contexto-mako-md*

### El webhook a OWNER_WS y el poll por-workspace fabrican el MISMO lead dos veces

Efecto de segundo orden del misrouteo que nadie busca: `meta-leads-poll` ya itera
correctamente por workspace (`correrPorWorkspace('meta')`) y crea el lead en el ws del
cliente, mientras el webhook `meta-leads` cae a OWNER_WS y crea otro con el MISMO
`meta_lead_id` en el ws1. El dedup por `meta_lead_id` no los une porque están en workspaces
distintos. La regla: cuando la misma entidad entra por dos puertas (evento push + cron
pull), el dedup sólo funciona si ambas puertas resuelven el mismo workspace; arreglar el
ruteo del webhook elimina el duplicado como efecto colateral. El contra-ejemplo bueno es
Resend: su `email_id` es globalmente único y apunta a la fila exacta (que ya trae su
`workspace_id`), así que no necesita resolver nada — identificador global → fila exacta es
la alternativa válida a la tabla de ruteo.

**Vive en:** app/api/webhooks/meta-leads/route.ts vs app/api/cron/meta-leads-poll/route.ts (cf. app/api/webhooks/resend/route.ts) · *2026-07-16 audit-owner-ws-misrouting*

### El ruteo de un webhook a su workspace no puede salir de `credenciales`: está cifrada

La pregunta obvia era «¿por qué no resolvemos el workspace buscando en credenciales el
CHATWOOT_ACCOUNT_ID / page_id que viene en el payload?». No se puede: `credenciales.valor_enc`
es AES-256-GCM y `credWs()` resuelve sólo hacia adelante (dado un ws, dame el valor) — no
hay WHERE posible por SQL. Por eso el único reverse-lookup del repo es `wsDeInstancia()`
sobre `evolution_instancias` (mig 0072), una tabla de ruteo en CLARO con `instance_name`
único. Dos consecuencias: (a) rutear un webhook nuevo exige espejar el identificador
NO-secreto en una tabla en claro, poblada desde el choke point de guardado, no desde los 4
route handlers; (b) resolver el ws por un campo no-secreto ANTES de verificar la firma es
seguro — la firma sigue gateando todos los efectos, y un id forjado rutea a un workspace
cuyo secret no matchea, así que rebota. Dato accionable: `meta_page_id` YA vive en claro en
`app_settings` (lo lee `pollMetaLeads` vía `configWs`), o sea Meta se puede rutear hoy sin
campo nuevo.

**Vive en:** lib/credenciales.ts · lib/workspace.ts (resolverDesdeCookies) · app/api/webhooks/evolution/route.ts (patrón) · lib/settings.ts · *2026-07-16 audit-owner-ws-misrouting*

---

## Superficie expuesta

### ⚠️ Una ruta de API que termina en extensión queda fuera del gate, y meterla en PUBLICOS saca más cosas de las que parece

El matcher de `proxy.ts:113` excluye del proxy CUALQUIER path que termine en
.png/.jpe?g/.svg/.webp/.gif/.ico/.css/.js/.woff2 — incluido `/api/loquesea/foo.png`. Ya
está escrito que por eso el bundle de /plan viaja sin login; lo que falta es la regla para
código nuevo: una URL «linda» tipo `/api/branding/asset/logo.png` queda sin login y sin
chequeo de Origin, en silencio, y el próximo que copie el patrón hereda el agujero. **Las
rutas de descarga van SIN extensión (`?id=`)** y el nombre real se fuerza por
Content-Disposition. Ojo al revés: `.mp4` y `.zip` NO están exentos, por eso `/vsl-assets`
tuvo que ir a PUBLICOS. Y agregar un prefijo a PUBLICOS no es solo «sacar el login»: el
early-return de `proxy.ts:38-42` corre ANTES del chequeo CSRF de Origin (:50-63) y ANTES
del fail-closed sin AUTH_SECRET (:66-72), así que esa ruta se queda solo con la auth que le
pongas vos.

**Vive en:** proxy.ts (PUBLICOS :29, matcher :113) · *2026-07-27 branding-mako-conocimientos*

### ⚠️ A /conocimiento se entraba escribiendo la URL, y falta el barrido del resto

No tenía botón en ningún lado, pero tipeando la ruta un cliente entraba igual: «un cliente
jamás debería poder acceder a esa ruta… no tenía ningún botón sobre como acceder, pero si
ponía la url, sí» (2026-07-17). Decisión: `/conocimiento` existe SOLO en SuperAdmin —con
`getSesionAdmin()`, no con `requireRolWs`, ver [Guards, roles y sesión](#guards-roles-y-sesión)—
y **queda pendiente auditar qué otras rutas se acceden por URL sin botón**. La ausencia de
link no es un control de acceso.

**Vive en:** app/conocimiento · el barrido pendiente sobre app/ · *decisión 2026-07-17*

### El fix del open redirect pasaba los cuatro casos pedidos y el agujero seguía abierto

`destinoSeguro()` normalizaba backslashes y rechazaba lo que empieza con '//'. Pasaba los
cuatro casos del pedido ('//evil.com', '/\\evil.com', 'https://evil.com', '/dashboard?x=1')
y aun así el verificador lo dio por NO cerrado: `'/\t//evil.com'` empieza con una sola '/',
pasa los dos checks, y el parser WHATWG strippea el tab inicial, así que
`new URL(next, origin)` resuelve a evil.com. Lo mismo con %0A y %0D. Reachable end-to-end
y sin cookie, porque app/login/page.tsx hacía `window.location.href = next` del lado del
cliente con una copia inline del mismo filtro. La regla doble: validar una URL con
`startsWith` es frágil porque el parser normaliza cosas que tu check no ve (hay que
rechazar los controles `\x00-\x1f\x7f` antes de mirar nada); y **un fix que pasa todos los
casos del pedido no es un hallazgo cerrado** — por eso la pasada de verificación adversarial
vale la corrida. Es la misma exigencia que pone el dueño sobre cualquier entrega: «Nada
funciona… Tienes que realmente validar y hacerlo bien» (2026-08-02).

**Vive en:** lib/auth-session.ts (destinoSeguro, hoy con el rechazo de caracteres de control) · app/login/page.tsx (la copia inline del filtro) · *2026-07-01 · ~verificar-fixes-seguridad*

### /conocimientos se comparte por link público, sin login

Decisión del 2026-07-27: «que yo le pueda pasar un link a cualquiera y pueda acceder a
eso». Al construirlo vale el corolario de
[Aislamiento multi-inquilino](#aislamiento-multi-inquilino): el workspace de una vista
pública sale de la FILA que resuelve el token del link, nunca del request — si sale del
request, sin cookie el contenido servido es el del dueño y va a «funcionar» de casualidad
hasta que un cliente comparta lo suyo.

**Vive en:** app/conocimientos · lib/workspace.ts:75-81 · *decisión 2026-07-27*
