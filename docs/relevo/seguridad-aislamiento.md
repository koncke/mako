# Relevo — Seguridad, cifrado y aislamiento entre clientes

**Ventana:** del commit `6785dc16` (05/10/2026 12:33) a `9862c146` (10/10/2026 18:59). 670 commits
en total; 46 migraciones nuevas (0193 → 0245); los de esta área, ~25. Escrito el 10/10/2026.

**Qué es esta parte del producto, para quien nunca la vio.** MaKo es una sola aplicación que
usan varios negocios a la vez. Cada negocio es un **workspace** (un número: el 1, el 9, el 11…).
Esta área contesta una sola pregunta: **que nada de un cliente llegue a otro.** Tres cosas
distintas, y hay que tenerlas separadas en la cabeza:

1. **La puerta de entrada** (`proxy.ts` + `lib/rutas-publicas.ts`): qué se atiende sin estar
   logueado y con qué método.
2. **El aislamiento de los datos** (`lib/workspace.ts`): quién decide, en cada consulta, de qué
   workspace son las filas. Y a dónde cae eso cuando nadie lo dijo.
3. **Las credenciales del cliente** (`lib/credenciales.ts`, `lib/cripto-credenciales.ts`): los
   tokens de Meta, Google, WhatsApp y las keys de IA que cada negocio conecta, cifrados.

**Dos nombres que hay que aprender ANTES de leer el resto, porque todo lo demás cuelga de ahí:**

- **`OWNER_WS` vale 1, y el workspace 1 es de Mauricio Bustos, que es un CLIENTE.** La constante
  se llama así porque MaKo nació como el dashboard de su agencia. Cuando nadie dice de quién es
  algo —un cron, un webhook, un pedido sin cookie— el workspace efectivo cae al 1. O sea que
  cualquier olvido se convierte en una fuga de datos de un cliente real.
- **`wsSuperAdmin()` es el workspace de la plataforma: hoy el 9. Y el 9 TAMBIÉN es un negocio
  real que usa Martín.** Esto mordió en esta misma ventana (ver §5.1): «la plataforma» no es un
  workspace, es una clave propia.

**Mis rutas:** `lib/credenciales.ts` · `lib/workspace.ts` · `lib/tablas-de-inquilino.ts` ·
`lib/rutas-publicas.ts` · `proxy.ts` · `app/api/auth/`.
⚠️ **`lib/cifrado*.ts` NO EXISTE** (me lo asignaron por nombre y no está en el repo): el cifrado
de credenciales vive en **`lib/cripto-credenciales.ts`**.

---

## 1. En qué quedó: lo hecho y DESPLEGADO

Todo pusheado: `git log origin/main..HEAD` vacío al 10/10 19:00.

### 1.1 Lo que cerré/medí yo contra PRODUCCIÓN el 10/10/2026

Estas cuatro mediciones las hice hoy contra `https://hola-mako.com` y contra Supabase. Son el
estado de verdad; lo de abajo que no tenga una medición así va marcado como tal.

**Las páginas públicas siguen siendo de sólo lectura** (el arreglo de `5b6426aa`, 06/10, aguanta):

```
/login       POST=405  POST+next-action=405  GET=200
/privacidad  POST=405  POST+next-action=405  GET=200
/terminos    POST=405  POST+next-action=405  GET=200
/vsl         POST=405  POST+next-action=405  GET=308
/compartido  POST=405  POST+next-action=405  GET=404
/mi-curso    POST=403  POST+next-action=403  GET=307   ← la rama nueva del alumno
POST multipart a /login con $ACTION_ID_… en el cuerpo (sin header) → 405
```

**Las vistas de cohortes están cerradas.** La clave `anon` contra
`/rest/v1/v_cohortes_semanales` → **HTTP 401 `42501 permission denied for view`**. Antes de la
mig 0231 (09/10) contestaba 200 con 54 filas: la facturación, los cierres y las asistencias de
TODOS los clientes, con una clave que viaja al navegador.

**El código del token por hash está corriendo.** Un bearer inventado a `/api/v1/crm/leads` y a
`/api/agente/skill` contesta **401 con el texto de LA RUTA** («Token inválido o revocado»), no con
el del middleware («no autenticado»). Esa diferencia es la pista que dice si la ruta se ejecutó.

**El bucket de las fotos de los leads sigue siendo público.** GET anónimo, sin credencial, a
`…/storage/v1/object/public/avatars/leads/1/999999999.jpg` → cuerpo
`{"statusCode":"404","error":"not_found","code":"NoSuchKey"}`. O sea *«ese objeto no está»*, no
*«el bucket no es público»*. **No bajé ninguna foto real a propósito.** Sigue abierto (§4.1).

### 1.2 Las fugas que se cerraron en la ventana, con su commit

| Qué | Commit | Fecha |
|---|---|---|
| Una página pública sólo se LEE (por `/login` se ejecutaban server actions sin sesión contra el ws1) | `5b6426aa` | 06/10 |
| El cliente entra a su curso con SU cookie, nunca con una sesión de MaKo | `c0e2570b` | 06/10 |
| Los clientes heredan los mensajes de la PLATAFORMA, no de Mauricio | `157a302a` | 06/10 |
| …y la base deja de ser el store del ws9: clave propia | `7ad16c8a` | **10/10** |
| Los seis cruces entre clientes (links sin `?ws=`, el acuse del grupo, el mail de `/compartir`, el inbox, el drenador de corridas, la herencia) | `e307a6a6` `626325a5` `260bff7d` `157a302a` | 05-06/10 |
| Ruteo estricto en `/api/track` y en los tokens: «no pude leer» deja de contestarse como «no es de nadie» | `dd58b168` | 07/10 |
| Tokens detallados (`mako_pat_`) por hash, permisos por área, sólo `/api/v1` | `f2c0a04b` `b51155c9` | 08/10 |
| El token clásico deja de guardarse en claro: hash + pista | `dc25a921` `0f12fe27` | 09/10 |
| Las cohortes dejan de leerse con la clave pública (mig 0231) | `70d52565` | 09/10 |
| Chatwoot borrado del producto | `f98778f7` | 09/10 |

Los 91 guards del área pasan en HEAD. **Medido por mí el 10/10:**

```
node --import tsx --test tests/cruce-notificaciones.test.ts tests/link-con-workspace.test.ts \
  tests/acciones-sin-sesion.test.ts tests/rutas-publicas.test.ts tests/alumno-sesion.test.ts \
  tests/webhooks-ruteo-estricto.test.ts tests/api-mako-tokens.test.ts \
  tests/agente-token-hash.test.ts tests/tenant-tables-contract.test.ts tests/funnel-declarado.test.ts
→ 91 pass / 0 fail (5,2 s)
```

---

## 2. Lo que NACIÓ en la ventana y el 05/10 no existía

### 2.1 Una segunda clase de sesión: el ALUMNO (`c0e2570b`, 06-07/10)

Es lo más grande que nació acá. Un cliente del cliente —alguien invitado a un curso— entra a
MaKo **sin ser usuario de MaKo**.

- **Cookie propia, `mako_alumno`**, firmada aparte: `al1.<ws>.<lead>.<version>.<exp>.<firma>`,
  30 días (`lib/alumno-sesion.ts`). El prefijo `al1.` hace que ninguna otra firma de la casa
  sirva como ésta ni al revés.
- **El alumno NUNCA recibe `mako_session` ni una fila en `usuarios`, y el porqué está medido**
  (está escrito en la cabecera de `lib/alumno-sesion.ts`): para el proxy una sesión válida pasa
  por todas las rutas que no son `/admin`; `requireRolWs` manda un rol desconocido a `/crm`;
  `getRolWsEfectivo` cae a `'admin'`; y 98 APIs más las acciones de `app/crm/actions.ts` no miran
  el rol. **Con una fila en `usuarios`, el alumno leía el CRM de Mauricio.**
- **Lo único que se le abre es `/mi-curso`**, por una rama propia del proxy
  (`decidirRutaAlumno`, `lib/rutas-publicas.ts:209`), con match EXACTO y sólo GET/HEAD.
  ⚠️ **No está en `PUBLICOS` a propósito**: estar ahí significa «no leo cookie», y esta página SÍ
  lee una.
- **Entra también por Google** (`app/api/auth/callback/google/route.ts`): si el email no está en
  `usuarios` pero tiene una invitación vigente, se le pone la cookie de alumno y va a
  `/mi-curso`, ignorando el `?next=`. `usuarios` gana siempre, así que un suspendido no se puede
  colar por ahí.
- **El logout la borra** con las mismas opciones con las que se pone (`app/api/auth/logout`): con
  otro `path`, el navegador no la borra.
- **La firma no alcanza y eso está resuelto:** si el acceso sigue vigente lo contesta la base EN
  CADA PEDIDO (`resolverAcceso`, `lib/alumno-acceso.ts`). Revocar sube la versión y corta la
  cookie en el pedido siguiente.

### 2.2 Las credenciales de la API de MaKo pasaron a hash (08-09/10)

Dos clases de token, dos puertas:

- **El clásico** (`agente_token`, el de la skill de Claude del cliente): hasta el 09/10 vivía
  **en claro** en `app_settings` y en `webhook_routing`. Desde `dc25a921` se guarda como sha256 +
  una pista no secreta (`mkoag_e_…a1b2`) y se muestra UNA sola vez. Vale en `/api/agente/*` y en
  `/api/v1`.
- **Los detallados** (`mako_pat_`, la tab `/api-mako`, `lib/api-mako/tokens.ts`): hash, permisos
  por área y vencimiento. **Valen sólo en `/api/v1`** — `/api/agente/*` no los conoce. Sus
  permisos se miran en `gatingOk`, que es la misma guarda que corre al CONFIRMAR una acción.

⚠️ **LO MÁS IMPORTANTE DE TODO ESTE BRIEFING: NO SE PUEDE VOLVER A UN DEPLOY ANTERIOR A
`dc25a921`.** La conversión de las filas que quedaban se corrió **en producción el 09/10/2026 a
las 16:07 (−03)**: 3 settings (ws1, ws9, ws11) pasados a hash y 5 filas en claro borradas del
índice. Releído después: 0 en claro, 3 por hash.

**Por qué no se puede volver, explicado:** el código anterior a `dc25a921` lee el setting como si
fuera el token en texto plano. Después de la conversión ahí sólo hay un sha256. Entonces el
código viejo (a) compara el bearer que le presentan contra un hash, así que **ningún token
autentica**, y (b) `/api/agente/skill` armaba el archivo releyendo el setting, así que le
entregaría **el hash como si fuera el token**. Las tres skills instaladas dejan de funcionar **sin
un solo error que lo explique**: contestan 401 «token inválido o revocado», que es exactamente lo
que se ve cuando el token está mal. Y no hay vuelta atrás posible porque el texto plano ya no
existe en ningún lado — por diseño. La salida, si pasara, es que cada cliente apriete «Generar
otro» en `/integraciones`.

### 2.3 «No pude leer» dejó de ser «no es de nadie» (`dd58b168`, 07/10)

Seis lugares que deciden de quién es algo que entra SIN sesión usaban una lectura que, con la base
caída, devuelve `null` — y `null` se leía como «no es de ningún negocio». Ahora:
`/api/track/optin` reintenta y, si no puede, anota en `webhooks.fallos_ruteo` y va 503; los
beacons de medición van 503 sin reintento (reintentar le suma carga a una base caída); y el token
del agente contesta **503 «no pude verificar»**, nunca 401 — un 401 sobre un token bueno manda a
la persona a rotarlo. En credenciales nació `credWsEstricta` (`lib/credenciales.ts:131`) para lo
mismo: `credWs` la usa medio producto y que empiece a tirar le cambiaría el comportamiento a todos.

### 2.4 Superficie pública NUEVA (toda en `lib/rutas-publicas.ts`)

| Ruta | Qué es | Cómo se autentica |
|---|---|---|
| `/m.js` (09/10) | el cargador del Pixel: la línea que el cliente pega en SU página | token público del query; no lee cookie. GET anónimo con un token falso → **404** (medido 10/10) |
| `/api/alumno/link` · `/api/alumno/entrar` (07/10) | «soy alumno: entrar con mi email» | el token firmado del link, en el CUERPO |
| `/api/compartido/curso/entrega` · `/api/compartido/comunidad` (07/10) | el portal del curso: subir una entrega, la comunidad | el token del portal, en el CUERPO. Entraron a `PUBLICOS_ESCRITURA` |
| `/api/webhooks/zernio` (09/10) | Instagram y Messenger como canal | firma HMAC + `?w=<ws>`; **fail-closed**: sin secreto, sin firma o con `?w=` roto, 401 |
| `/api/webhooks/resend` · `/api/webhooks/email-entrante` (09/10) | entregas y respuestas de email | firma Svix; sin firma válida, 401 |

Los tres webhooks nuevos usan la lectura ESTRICTA de ruteo y pasan el guard
`tests/webhooks-ruteo-estricto.test.ts`, que barre `app/` y `lib/` enteros.

`PUBLICOS_ESCRITURA` tiene hoy **cinco** entradas. `/api/compartido/tarea` se fue el 06/10
(`eba4f12f`) y no volvió.

### 2.5 Chatwoot borrado (`f98778f7`, 09/10)

Martín: *«que no exista más, guardalo en privado»*. El código entero está en la etiqueta de git
**`archivo/chatwoot-2026-10-09`**. `lib/chatwoot.ts` quedó como **cascarón** —cero pedidos, cero
credenciales— porque lo importan archivos que la rama `wip/api-acciones-0910` tiene a medio
cambiar; cuando esa rama entre, se borra entero. Las tarjetas salieron de
`lib/integraciones-catalogo.ts` y de `lib/metodo-catalogo.ts`, así que **nadie puede volver a
configurarlo**. `tests/sin-chatwoot.test.ts` lo fija en positivo.

### 2.6 Las dos listas de tablas crecieron

- `TENANT_TABLES` (`lib/workspace.ts:85`): **119** tablas. Es la que `getTenantDb()` scopea.
- `TABLAS_DE_INQUILINO` (`lib/tablas-de-inquilino.ts:45`): **120**. Es la que se usa para vaciar
  o borrar un inquilino.
- En la ventana nacieron **29 tablas nuevas con `workspace_id`** (curso, comunidad, etiquetas,
  adjuntos, hilos…). 28 entraron a `TENANT_TABLES`. **Una no: `email_entrantes`** (mig 0245,
  09/10) — ver §4.2.

---

## 3. Lo que CORREGÍ del briefing del 06/10 (afirmaciones que ya no son ciertas)

| El briefing del 06/10 decía | Lo cierto al 10/10, con la prueba |
|---|---|
| «Hay trabajo SIN COMMITEAR de otra sesión justo encima del proxy… el riesgo es que una sesión futura pise `proxy.ts`» (§2.5) | **Se commiteó el mismo 06/10 en `c0e2570b`.** `decidirRutaAlumno` está en `lib/rutas-publicas.ts:209`, la rama en `proxy.ts:208`, y medí `/mi-curso` en producción: POST 403, GET 307. El riesgo se cerró |
| «La base de la herencia pasa a ser `wsSuperAdmin()` — la plataforma, cuyo store hoy está vacío» (cruce 6) | **Era verdad a medias y durante cuatro días fue una fuga nueva.** `wsSuperAdmin()` es el ws9, que es un negocio real de Martín: lo que él cambiaba en «MaKo en WhatsApp» de SU negocio —prender, apagar, un texto, una cadencia— **lo heredaba todo cliente que no lo hubiera tocado**, sin que la pantalla lo dijera. Lo cerró `7ad16c8a` (10/10 13:18) dándole a la base su propia clave, `mako.plantillas.base`, que sólo edita `/mensajes` desde la plataforma. Medido ese día: las dos claves vacías, no hubo nada que mudar |
| «53 `?? OWNER_WS` en 37 archivos» | **54 en 39 archivos, pero sólo 41 son código: 13 están en COMENTARIOS** (`git grep "?? OWNER_WS" HEAD -- 'lib/*.ts' 'app/**/*.ts'`, separando las líneas que arrancan con `//` o `*`). O sea que el número vivo nunca fue 53. Nuevos en la ventana: `app/api/ads-manager/adset-add/route.ts:83` y `creative-upload/route.ts:272`, las dos detrás del gate de sesión. El de `app/api/webhooks/fathom/route.ts:180` **es un comentario histórico, no código**: ese webhook ya resuelve su workspace |
| «53 acciones de `app/crm/actions.ts`» sin guarda propia | **Son 50** (`grep -c "^export async function .*Action"`), y **CERO verifican la sesión** en sus primeras líneas. `deleteLeadAction` se movió a `:1106` y `exportLeadsAction` a `:1683` (el briefing decía `:968` y `:1537`) |
| «Las vistas `v_cohortes_*` siguen abiertas al rol anon» (venía de `hallazgos-seguridad.md`) | **Cerradas el 09/10** por la mig 0231 (`70d52565`). Medido por mí el 10/10: 401 `permission denied` con la clave pública, y la service role sigue leyendo |
| «4.1 Los reportes diario y horario siguen siendo sólo del ws1» | **Sigue siendo cierto** (verificado: ninguno de los dos llama `listarWorkspaces` ni `runWithWorkspace`), pero **cambió el canal**: desde `90c5e313` (10/10) **ningún reporte sale por WhatsApp**. Decisión de Martín: *«Apagar WhatsApp en los reportes»*, porque desde que se borró Chatwoot no tenían por dónde salir. Una constante, `REPORTE_POR_WHATSAPP = false` (`lib/mensaje-canales.ts:35`), que leen los tres lugares que decidían |

---

## 4. Lo que quedó a medio hacer o SIN VERIFICAR, con el archivo donde vive

### 4.1 ⚠️ Las caras de los leads siguen en un bucket PÚBLICO

**Vive en:** `lib/fotos-contacto.ts:86` (`getPublicUrl`) · `app/api/cron/fotos-contacto/` ·
`app/api/perfil/avatar/route.ts:47` (que crea el bucket `avatars` con `{ public: true }`).

**Sin tocar desde el 06/10** (`git log -- lib/fotos-contacto.ts` → sólo `0418a6ab`). Re-medido
por mí el 10/10 (§1.1): la ruta se lee sin ninguna credencial y lo único que protege la foto es
adivinar dos enteros chicos (`<ws>` va de 1 a ~17, `<lead>` es el id de la fila). La cara de una
persona que le escribió a un cliente es un dato personal de un tercero. **No es un cruce entre
workspaces** —nadie ve el panel de otro—, es superficie pública que nadie marcó como tal.

### 4.2 ⚠️ El guard de aislamiento de tablas sólo cubre las de 2024

**Vive en:** `tests/tenant-tables-contract.test.ts:72`.

Ese test tiene dos mitades y la segunda miente por omisión. La *forward* («toda tabla de
`TENANT_TABLES` tiene `workspace_id`») cubre las 119. La *inverse* («toda tabla con
`workspace_id` está scopeada») **sólo recorre las tablas del loop bulk de la migración 0054** —lo
dice su propio nombre—. O sea que **una tabla nueva con `workspace_id` que alguien se olvide de
agregar a `TENANT_TABLES` no la caza nadie**, y el modo de falla está documentado: `getTenantDb()`
sobre una tabla que no está en el Set es **passthrough**, no «sin scope». Devuelve las filas de
cualquier workspace, sin dar error.

Medido hoy: de las 29 tablas con `workspace_id` que nacieron en la ventana, **`email_entrantes`
(mig 0245) está fuera del Set**. Hoy no es una fuga —`lib/email-entrante.ts` usa el cliente de
servicio con el `workspace_id` explícito en el insert y lee por `email_id`, que es único global—
pero es exactamente la forma del bug de `avisos_programados` del 30/09. Las otras seis que están
fuera del Set (`shares`, `webhook_routing`, `branding_assets`, `credenciales_auditoria`,
`agente_consentimiento`, y las tres excepciones declaradas `app_settings`, `credenciales`,
`funnel_config`) están cada una concentrada en UN módulo que las scopea a mano, y las dos
primeras son cross-workspace por diseño.

### 4.3 ⚠️ El reporte semanal multi-inquilino NUNCA corrió, y el dry-run NO se pudo hacer

**Vive en:** `app/api/cron/reporte-semanal/route.ts` · `vercel.json:93`.

`"schedule": "20 14 * * 1"` → **lunes**. El cambio se desplegó el martes 06/10, así que la
primera corrida real es el **lunes 12/10/2026 a las 14:20 UTC**, y es la primera vez que ese cron
le manda algo a un cliente que no sea Mauricio.

Verificado hoy en el código: el cron **sí** itera los workspaces activos y corre cada uno adentro
de `runWithWorkspace(w.id, …)` (`:97-99`). Y `DEFAULT_PREFS.semanal` es
`{ activo: true, wa: true, email: true }` (`lib/perfil.ts:233`), así que con WhatsApp apagado por
`REPORTE_POR_WHATSAPP = false` **el reporte le sale por EMAIL a todo workspace activo que tenga un
destinatario**, sin que nadie haya tocado nada.

⚠️ **Intenté correr el `?dry=1` contra producción y NO PUDE: el `CRON_SECRET` del `.env` de este
clon no es el de producción.** La ruta contestó su propio `{"ok":false,"error":"Unauthorized"}`
(401 de `checkCronAuth`, `lib/cron-auth.ts:15`), o sea que llegó y el secreto no coincide. **El
dry-run sigue pendiente y hay que hacerlo con el secreto de Vercel antes del lunes**: `dry`
devuelve antes de `buildReporteSemanal` y de `despacharReporte` (`:60-68`), así que es seguro, y
lista los destinatarios enmascarados. Si sale mal, salen mails de verdad a negocios de verdad.

### 4.4 ⚠️ Cinco de los seis cruces siguen SIN verificar contra producción

Los guards (`tests/cruce-notificaciones.test.ts`, `tests/link-con-workspace.test.ts`) **leen el
FUENTE, no el comportamiento** — lo dice su propio encabezado. Prueban que el código dice lo
correcto, no que el runtime lo haga. El único de los seis con una medición real es el de las
páginas públicas / server actions, que re-verifiqué hoy. Nada entre el 06/10 y el 10/10 registró
una verificación de los otros cinco (`docs/hallazgos-comunicacion.md` → «Que jamás se crucen los
mensajes entre clientes: seis familias»). Lo que falta observar:

| Cruce | Cómo se comprueba de verdad |
|---|---|
| El acuse de un grupo de WhatsApp | mandar «ok» en un grupo de un cliente y ver que **no** se cierren insistencias del ws1 |
| El mail de `/compartir` | compartir material con la pestaña parada en el ws11 y mirar el `From:` del mail (debe ser el de MaKo) |
| El drenador de corridas | buscar en `flujo_corridas` una corrida vencida de un workspace que no sea el 1 y ver que despierte |
| La herencia del store | abrir `/mensajes` con un workspace sin store propio y confirmar que el ejemplo no trae los números de Mauricio **ni lo que el ws9 editó para sí** (esto último es nuevo: lo cerró `7ad16c8a` el 10/10 y no se verificó) |
| Los links con `?ws=` | abrir el «Verlo en MaKo» de un aviso de un cliente y mirar que la URL lleve su `?ws=` |

### 4.5 ⚠️ El uso real de una skill DESPUÉS de la conversión a hash

No hay forma de probarlo sin el valor de un token, y por diseño ya no se guarda. Lo que se sabe:
las rutas contestan con su propio 401 (medido hoy, §1.1) y los 15 tests cubren el camino por
hash. **La prueba de verdad es el próximo uso**, y se lee en
`app_settings.api_tokens_uso` → `principal`. Último uso registrado del ws1: 03:02 UTC del 09/10,
o sea **antes** de convertir. Si un cliente dice que su skill dejó de andar, es esto.

### 4.6 Lo más chico, pero anotado

- **`docs/auditoria-aislamiento-workspace.md` no se toca desde el 05/07/2026** (`c5615a0c`, tres
  meses). Es el mapa de qué se scopea por workspace y qué no. Ni los seis cruces del 06/10 ni
  nada de esta ventana están reflejados ahí. Hoy es un documento que miente por viejo.
- **Las 50 acciones de `app/crm/actions.ts` no miran la sesión** (§3). Hoy están cubiertas **por
  el proxy** —sin sesión ya no llegan— pero no tienen corte propio, y con una sesión de cualquier
  rol corren acotadas a su workspace. El barrido nunca se hizo.
- **La tabla `notificaciones` (mig 0048) nunca se aplicó en producción** (anotado el 23/09, sigue
  igual: no está en ninguna de las dos listas de tablas). Un aviso que no sale por WhatsApp no
  queda registrado en ningún lado.
- **Dos migraciones con el MISMO número: `0223_curso_papelera.sql` y `0223_flujo_grafo.sql`.** Es
  el choque de recurso compartido que AGENTS.md advierte (dos sesiones eligen el mismo número a la
  vez). No es de esta área, pero vive en la serie que auditás; el día que alguien corra las
  migraciones en orden, el orden entre esas dos es el del sistema de archivos.

---

## 5. Las trampas del área

**5.1 «La plataforma» no es un workspace: es una CLAVE.** La regla vieja —«`OWNER_WS` no es la
plataforma, es un cliente; lo de MaKo va en `wsSuperAdmin()`»— es correcta y **no alcanza**, y
eso se pagó en esta ventana. El ws9 es el workspace de la plataforma **y además un negocio real
que Martín usa**: usar su store como «lo de fábrica» convirtió sus propias ediciones en el default
de todos los clientes. La prueba mental que lo detecta: *probalo con dos.* Si el valor «de la
plataforma» se puede editar desde una pantalla de negocio, no es de la plataforma.

**5.2 El TEXTO de un 401 dice QUIÉN contestó, y los dos se ven iguales desde afuera.**
«no autenticado» = contestó `proxy.ts`, la ruta ni se ejecutó (le falta estar en `PUBLICOS`).
El error propio de la ruta = la ruta corrió y el problema es la credencial. Sin distinguirlos se
buscan headers y entornos que no tienen nada que ver. **Y en local esto NO se ve:** sin
`AUTH_SECRET`, `gateConfigurado()` es false y el middleware hace no-op, así que una ruta que le
falta en la lista anda perfecto contra `localhost` y falla sólo en producción. La integración con
Claude vivió meses así.

**5.3 Un guard verde no quiere decir que el agujero esté cerrado: quiere decir que el guard no lo
ve.** `tests/link-con-workspace.test.ts` existía desde el 05/10 y daba verde sobre los 25 links
que seguían rotos. Las tres correcciones valen para cualquier guard que lea fuente: se enumera lo
PERMITIDO (la lista de rutas públicas, que no se movió en seis meses) y no lo prohibido (la lista
de pantallas, que crece con el producto y envejece sola); una ruta guardada en una variable es una
FALLA, no un «no sé»; y se exime por BLOQUE —la función con su cierre real—, nunca por archivo.
§4.2 es la versión viva de esto.

**5.4 Una VISTA no tiene RLS, y el `revoke` tiene que ser POSTERIOR a su última creación.**
`alter table … enable row level security` no existe para una vista, y una vista corre con los
permisos de su DUEÑO, que se saltea el RLS de las tablas de abajo. Van las dos líneas:
`set (security_invoker = on)` + `revoke all … from anon, authenticated`. Y la sutileza que el
guard de las cohortes enseñó el 09/10: **una vista re-creada (`drop` + `create`) nace sin lo que
se le hizo antes**, así que un revoke viejo no la cubre. `tests/funnel-declarado.test.ts` ahora lo
exige en la misma migración o en una posterior a la ÚLTIMA creación, y ya no tiene lista de
excusas.

**5.5 El `CRON_SECRET` de este clon NO es el de producción.** No se puede disparar ni un `?dry=1`
de un cron desde acá (§4.3). El síntoma es un 401 con el JSON de `checkCronAuth` — y es fácil
leerlo como «la ruta está rota».

**5.6 `hidratarCredenciales` no filtra por catálogo.** En cada arranque lee **todas** las filas
de `credenciales` del ws1 y las escribe en `process.env` (`lib/credenciales.ts:390-405`). Sacar
una integración del catálogo —como se hizo con Chatwoot el 09/10— **no saca sus filas del
entorno**: siguen hidratándose para siempre. Hoy no hay quién las lea (`lib/chatwoot.ts` es un
cascarón), pero una credencial retirada que vuelve al entorno en cada boot es la que hereda la
próxima feature que use ese nombre de env.

**5.7 Un 404 de Supabase Storage no dice que el bucket sea privado.** `NoSuchKey` es *«el objeto
no está»*. Si querés saber si un prefijo está protegido, la pregunta es cómo se crea el bucket
(`createBucket(..., { public: true })`) y con qué se sirve la URL (`getPublicUrl` vs una URL
firmada), nunca el código de una clave que no existe.

**5.8 Sin un corte, lo que falla es el SILENCIO.** Los seis cruces compartían el modo de falla:
no daba error. El acuse cerraba insistencias ajenas devolviendo «ok». El inbox mandaba por el
canal de otro y el envío volvía «ok». El mail de `/compartir` salía válido las dos veces — *por
eso nadie lo ve*. Y el ejemplo nuevo de la ventana es el mismo: lo que el ws9 editaba para sí
aparecía como texto de fábrica en el editor de siete clientes, sin un error, sin una pantalla que
lo dijera.

**5.9 El diagnóstico obvio de lo de `/login` era el corto y estaba mal.** Parecía «cortar el
header `next-action`». Next **también** procesa una acción que llega como POST de formulario
(multipart o urlencoded) con `$ACTION_ID_<id>` en el cuerpo, **sin header**. Por eso el corte es
por MÉTODO y no por header, y por eso hoy medí las dos formas (§1.1).

**5.10 La pregunta de aislamiento es por el WORKSPACE, no por el usuario.** El super admin sigue
siendo admin cuando entra al workspace de un cliente con `?ws=N`: `getSesionAdmin()` contesta
«¿quién mira es admin?», que es otra pregunta. Lo que hay que preguntar es
`wsActual === await wsSuperAdmin()`.

---

## 6. Qué espera una decisión de Martín

**6.1 La foto de los leads en un bucket público (§4.1).** Es la que está abierta hace más tiempo.
(a) Dejarlo: la URL es pública y la protege la dificultad de adivinar `<ws>/<lead>`. (b) Pasar ese
prefijo a privado y servir la foto por URL firmada, como ya hace el portal del curso. (c) Dejar el
bucket público pero poner un nombre no adivinable (un hash en vez del id del lead). **La (c) es la
más barata y cierra el único riesgo real, que es la enumeración.**

**6.2 Los reportes diario y horario siguen siendo sólo del ws1 (§3).** El semanal ya es
multi-inquilino; los otros dos leen el interruptor, el teléfono y el mail del ws1 sin envolver
nada, así que **las preferencias de notificación de los demás clientes son decorativas para esos
dos caminos**: la pantalla los deja configurar y nada los lee. (a) Dejarlo y sacarlos de la lista
que ve el cliente en `/mensajes`, para no prometerle algo que no sale. (b) Multi-inquilinizarlos
como el semanal. (c) Dejarlo y anotar que es a propósito. Vive en
`app/api/cron/reporte-diario/route.ts`, `-horario` y `lib/perfil.ts`.

**6.3 El barrido de las 50 acciones sin guarda propia (§4.6).** (a) No hacer nada: el proxy ya
corta sin sesión. (b) Un guard de fuente que exija que toda `export async function …Action`
empiece verificando sesión, con lista blanca en positivo para las excepciones. (c) Un barrido a
mano, que envejece. **La (b) es la única que no envejece**, y es el molde que ya funcionó dos
veces en esta área.

**6.4 Los 41 `?? OWNER_WS` vivos (§3).** Es la raíz común de casi todo lo de arriba y es trabajo
grande. (a) Dejarlos y confiar en los guards puntuales. (b) Que `OWNER_WS` deje de ser el fallback
y que un workspace sin resolver **tire**, migrando los call-sites de a tandas (fail-closed, pero
puede romper crons que hoy andan). (c) Partir la diferencia: fail-closed sólo en lo que ESCRIBE o
manda un mensaje, y dejar el fallback en lo que sólo lee. Es una decisión de arquitectura, no un
arreglo.

**6.5 El guard inverso de `TENANT_TABLES` (§4.2).** Hoy sólo cubre las tablas de la mig 0054, o
sea ninguna de las 29 que nacieron esta semana. (a) Extenderlo a TODAS las migraciones, con una
lista blanca explícita para las cross-workspace a propósito (`shares`, `webhook_routing`) y las
tres excepciones declaradas. (b) Dejarlo y agregar `email_entrantes` a mano. **La (a) es la que
evita que vuelva**; la (b) arregla el caso y deja el agujero.

**6.6 `docs/auditoria-aislamiento-workspace.md`, tres meses viejo (§4.6).** O se reescribe contra
el estado de hoy, o se borra y se deja `docs/hallazgos-seguridad.md` como la única fuente. Un
documento de seguridad desactualizado es peor que ninguno: alguien lo va a leer como el mapa.
