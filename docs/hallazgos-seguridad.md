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

- La credencial del repo de la agencia se le servía a los clientes por la API, y `serviciosPara()` —la
  función escrita para evitarlo— no la llamaba nadie → [GitHub en el panel de un cliente](#la-credencial-de-la-plataforma-adentro-del-panel-de-un-cliente-github).
- Los guards que suenan a «solo la agencia» no lo son: tres de cuatro los pasa cualquier admin-cliente, y el único que cierra de verdad es `getSesionAdmin()` → [Guards, roles y sesión](#guards-roles-y-sesión).
- Cuando no hay cookie, el workspace efectivo es el del DUEÑO: por default del resolver y por 29 `?? OWNER_WS` escritos a mano en 19 libs → [Aislamiento multi-inquilino](#aislamiento-multi-inquilino).
- `getTenantDb()` sobre una tabla que nadie registró no filtra nada y no avisa: el call-site cree estar aislado → [Aislamiento multi-inquilino](#aislamiento-multi-inquilino).
- Tres secretos de webhook son de plataforma y se los repartimos a los clientes (Chatwoot se lo escribe adentro de SU panel, Calendly se lo pide el tutorial, Evolution viajaba en un JSON) → [Webhooks y firmas](#webhooks-y-firmas).
- La migración de cifrado tiene tres verdes que no prueban nada y un paso irreversible cuyo backup está comentado → [Credenciales y cifrado](#credenciales-y-cifrado).
- Una ruta de API que termina en `.png` queda fuera del gate, y meter un prefijo en `PUBLICOS` saca más cosas de las que parece → [Superficie expuesta](#superficie-expuesta).
- Un `notFound()` corta el cuerpo y **deja el `<title>` puesto**: el guard funciona y la pantalla igual cuenta que existe → [Superficie expuesta](#notfound-no-tapa-los-metadatos-el-title-se-sirve-igual).

---

## La credencial de la PLATAFORMA adentro del panel de un cliente (GitHub)

*2026-08-24 — pedido del dueño: «revisá MUY bien que GitHub NO debe estar en los
workspace de clientes, solo de SuperAdmin». Existía, y por DOS caminos distintos.*

GitHub es el token del repo de la agencia, no de ningún negocio. Ya estaba marcado
`soloPlataforma: true` y ya había una regla con test (`defsVisibles`) que lo respetaba.
Y aun así se filtraba, porque **el flag estaba puesto y quien lo consulta contestaba otra
pregunta**.

### ⚠️ Camino 1 — `esSuper` preguntaba por el USUARIO, no por el WORKSPACE

`lib/integraciones.ts` hacía `const esSuper = !!(await getSesionAdmin())`. Eso contesta
*«¿quien mira es admin?»*, y el super admin **sigue siendo admin cuando entra al workspace
de un cliente con `?ws=N`**. Medido pidiendo el HTML servido:

| workspace | antes | después |
|---|---|---|
| ws13 (Código Inmobiliario) | «GitHub» ×12, `svc-github`, `GITHUB_TOKEN` ×2 | 0 |
| ws1 (Mauricio) | lo mismo | 0 |
| ws9 (la plataforma) | correcto | sigue correcto |

Y no era solo cosmético: ese modal **guarda con `ctx.ws`**, o sea en el workspace que se
esté mirando, mientras `lib/github-commits.ts` lo **lee** con `credWs(…, wsSuperAdmin())`.
Cargarlo desde ahí habría dejado el token del repo de la agencia adentro de las
credenciales de un cliente **y sin que la feature funcione**, porque el que lo lee mira
otro lado. (Verificado en prod: hoy `GITHUB_TOKEN`/`GITHUB_REPO` existen solo en el ws 9.
No llegó a pasar.)

### ⚠️⚠️ Camino 2 — la regla protegía la PANTALLA, no la API

Este es el grande, y es el que el dueño sospechaba. `/api/integraciones/credencial`
**nunca consultaba `soloPlataforma`**: sus cuatro caminos que resuelven un servicio —`GET`,
`guardar`, `descubrir-github` y `verificar`— llamaban al accessor crudo `servicioMetodo()`.
Verificado con curl y una sesión de **cliente** sobre el ws13:

```
GET /api/integraciones/credencial?servicio=github  →  200
{ "servicio": { "nombre": "GitHub", "paraQue": "…aparecieron 62 de golpe",
                "tutorial": {…5 pasos…}, "campos": [GITHUB_TOKEN, GITHUB_REPO] } }
```

No se filtraba el token (los campos vuelven `configurado:false`), pero sí la ficha entera:
que la integración existe, el copy interno de la agencia, el tutorial y los nombres de las
envs. Y `guardar` usaba el mismo accessor, así que el cliente podía **escribir**
`GITHUB_TOKEN` en su propia fila.

**Y `serviciosPara(esSuperAdmin)` —la función escrita exactamente para esto— NO LA LLAMABA
NADIE**: era código muerto desde que se escribió.

**El agravante, latente:** `descubrir-github` hacía `credWs('GITHUB_TOKEN')` **sin
workspace**, y `wsDefault()` cae a `getWorkspaceActual() ?? OWNER_WS`. Para una sesión
parada en OWNER_WS —que es *Mauricio, un cliente*— `lib/credenciales.ts` remata con
`if (w === OWNER_WS && esValorReal(process.env[clave])) return process.env[clave]`. O sea
que le habría prestado el token del repo de la agencia para listarle los repos privados.
Hoy `process.env.GITHUB_TOKEN` no está cargado en producción, así que el camino estaba
abierto y no vivo.

### Las tres reglas que quedan

1. **La pregunta es por el WORKSPACE, no por el usuario.** `wsActual === wsSuperAdmin()`,
   nunca `getSesionAdmin()`. Es la otra mitad del error que AGENTS.md ya tenía escrito
   («OWNER_WS no es la plataforma: es un cliente»). Parado en `?ws=13`, **ni el super
   admin** puede tocar la credencial de la plataforma — porque escribiría en la fila
   equivocada.
2. **Un flag declarado en un catálogo no protege nada hasta que alguien lo consulta, y el
   que lo consulta tiene que ser el CHOKE POINT.** Acá había cuatro ramas resolviendo
   servicio: cerrar tres deja la cuarta. Se puso un único resolvedor
   (`servicioDelContexto`) y las cuatro pasan por él. Devuelve **404, no 403**: un 403
   confirma que la integración existe, y eso ya es contar algo de la plataforma.
3. **Filtrar al PINTAR no alcanza si el dato ya viajó.** El filtro vivía en la capa de la
   grilla, así que la UI estaba bien y la API abierta. Un guard de visibilidad se prueba
   pidiéndole el dato al server con una sesión de cliente, no mirando la pantalla.

**Verificado después del arreglo** (sesión de cliente y sesión de admin impersonando):

```
ws13 cliente (rol=usuario)   github=400 sin ficha   descubrir-github=404
ws1  Mauricio (rol=usuario)  github=400 sin ficha   descubrir-github=404
ws13 con sesión de ADMIN     github=400 sin ficha   descubrir-github=404
ws9  la plataforma           github=200 FICHA(GITHUB_TOKEN|GITHUB_REPO)   descubrir-github=200
```

**Vive en:** `lib/integraciones.ts` (`esSuper`) ·
`app/api/integraciones/credencial/route.ts` (`servicioDelContexto`, `esPlataforma`) ·
`lib/metodo-catalogo.ts` (`serviciosPara`) · `tests/integraciones-visibles.test.ts`

### ~~PENDIENTE~~ RESUELTO — el catálogo entero viajaba en el bundle del cliente

*Cerrado el 25/08/2026.* Los tres componentes `'use client'` que lo importaban
—`IntegracionesBoard`, `OnboardingInstagram` y `MetodoWizard`— ahora lo reciben **por
props** desde su server component, y `/metodo` lo pasa **ya filtrado** con
`serviciosPara()`. De las 145 KB usaban dos campos, un tutorial y una lista.

El candado es `import 'server-only'` en el módulo: importar un VALOR desde un
`'use client'` rompe el build. Los tipos siguen viajando con `import type`, que se
borra en compilación.

De paso salió un antipatrón que lo explicaba: `IntegracionesBoard` tenía el tipo
`Integracion` **copiado a mano** para no importar del server — y por eso, al sumarle
dos campos del lado del server, la copia se quedó vieja sin que nada fallara. Un tipo
duplicado para esquivar una frontera es la señal de que la frontera falta.

Lo cuida `tests/catalogo-fuera-del-bundle.test.ts`, que chequea las dos mitades: que el
`server-only` siga puesto, y que ningún componente cliente lo importe como valor.

**La regla quedó en AGENTS.md**: «`'use client'` es una frontera de DATOS, no solo de
interactividad» — y su corolario, *filtrar al pintar no sirve si el dato ya viajó*.

<details><summary>El diagnóstico original</summary>

`lib/metodo-catalogo.ts` **no tiene `server-only`** y es isomórfico a propósito («Este
módulo lo usa también la UI (client)»). Lo importan tres componentes `'use client'`:
`IntegracionesBoard.tsx:30` y `OnboardingInstagram.tsx:22` (vía `servicioMetodo`, que
cierra sobre el array entero) y `MetodoWizard.tsx:13` (`SERVICIOS_METODO` completo). Con
eso, la entrada de GitHub —nombre, envs, tutorial y el copy interno de la agencia— **está
en el JS que descarga cualquier cliente**. Verificado en los chunks del build.

No es un secreto: es metadata. Pero es información interna de la agencia en el navegador
de un cliente.

</details>

### El token de GitHub: qué se auditó y qué NO alcanza con código

*2026-08-25 — pedido del dueño: «metele ciberseguridad. Alguien que pueda acceder a
ese token puede robar toda la app».*

**Primero la distinción que cambia la prioridad, porque es fácil confundirla:** lo que
viajaba en 4 chunks del bundle era **el NOMBRE de la env** (`"GITHUB_TOKEN"`), no el
valor. El valor vive cifrado (gcm2, HKDF por `(ws, clave)` con AAD) y solo lo lee el
server. Igual se sacó —la superficie que no se entrega es la que no hay que defender—
pero no era por donde se roba nada.

**¿Se puede robar el token hoy? NO.** Cinco frentes lo atacaron con curl desde sesiones
reales de ws1 y ws13 y todos rebotaron. Lo que se auditó y **cierra**: `puedeRevelar`
exige ser dueño del workspace donde vive la fila · la impersonación no da lectura ajena
(`proxy.ts` borra el header interno y solo lo repone para rol global admin) · el
cifrado v2 ata cada criptograma a su fila, así que copiarla a otro ws no abre · la
auditoría no guarda el valor · ningún `console.*` lo imprime · la tabla no es
alcanzable con la anon key (RLS sin policies) · no se publican sourcemaps · el cron de
commits es fail-closed (verificado contra producción: `Unauthorized`) · ninguna tool
del chat toca GitHub · y las credenciales más peligrosas (`CRON_SECRET`,
`SUPABASE_SERVICE_ROLE_KEY`, `CREDENCIALES_SECRET`, `AUTH_SECRET`…) están **fuera del
catálogo**, así que ninguna ruta de credenciales las puede leer.

### ⚠️ Lo que sí estaba abierto: el guard cubría 4 de 6 caminos

El 24/08 se puso `servicioDelContexto()` en los cuatro caminos que resuelven un
**servicio** (GET, `guardar`, `descubrir-github`, `verificar`), y en el mismo
comentario quedó escrito que *«cerrar tres deja el cuarto abierto»*. Quedaron dos:
`revelar` y `borrar`, que no toman `servicio` sino **`env`**, con su única validación
`ENVS_METODO.has(env)`.

Esa whitelist **no filtra plataforma**: se arma con `!s.soloServidor`, una bandera que
hoy no usa ningún servicio, así que `GITHUB_TOKEN` está adentro. `puedeRevelar` igual
lo frenaba —exige ser dueño del workspace donde está la fila, y la fila solo vive en el
ws9— pero la puerta estaba sin el cartel de las demás, y `borrar` no tenía ni esa
comprobación de rol.

**La regla que queda: un guard va donde se resuelve el PERMISO, y si el mismo recurso
se nombra de dos formas (por servicio y por env), hacen falta las dos puertas.** Ahora
existe `envDelContexto()`. Verificado con curl:

| workspace | `revelar GITHUB_TOKEN` |
|---|---|
| ws13 (cliente) | `400 clave inválida` |
| ws1 (Mauricio, OWNER_WS) | `400 clave inválida` |
| ws9 (la plataforma) | `200` — correcto, es su credencial |

### ⚠️⚠️ Y LO QUE NO SE ARREGLA CON CÓDIGO: el token vale mucho más de lo que la app promete

Comprobado contra `api.github.com` **solo con GET**, descifrando la fila de producción:
es un `github_pat_` fine-grained que **ve 15 repos, 13 de ellos privados —incluidos
codebases de otros clientes de la agencia—** y tiene al menos un permiso de
**escritura** (`codespaces_secrets`).

Mientras tanto el catálogo le promete al dueño *«Contents: Read-only sobre este repo,
no puede escribir nada»*. **El tutorial describe un token que no es el que está
puesto.**

Lo que sí acota el daño (verificado): no puede borrar ni transferir repos ni cambiar la
visibilidad (`administration` no lo tiene), y la cuenta no tiene secretos de CI que
robar (`actions/secrets` → 0), así que **no es un puente hacia las credenciales de
Vercel o Supabase**.

**La acción de mayor impacto de toda esta auditoría no es tocar código: es rotar ese
token** con el alcance que el propio tutorial promete —un repo, Contents: read-only— y
con expiración. Reduce el daño de cualquier filtración futura pase lo que pase con los
demás caminos. **Queda para el dueño: no se puede hacer desde el repo.**

### ⚠️ Lo que quedó SIN verificar y hay que mirar a mano

`vercel env ls production` **no es el inventario completo del entorno**: no lista
`GITHUB_TOKEN`, pero tampoco `AUTH_SECRET` ni `CREDENCIALES_SECRET` — y sin esas dos la
app no firma sesiones ni descifra una sola credencial, y producción funciona. Lo más
probable es que haya variables compartidas a nivel de equipo que el CLI no enumera.

Importa porque **el fallback `if (w === OWNER_WS && process.env[clave])` de
`lib/credenciales.ts` sigue anclado a OWNER_WS, que es un CLIENTE (Mauricio), no la
plataforma.** Hoy el conjunto que filtra es vacío *por accidente de configuración*, no
por diseño: el día que alguien ponga una clave de plataforma en las env vars de Vercel,
esa línea se vuelve una fuga viva sin que nadie toque código. **Pendiente:** anclarlo a
`wsSuperAdmin()` en `credWs`, `estadoCampo` y `envCred`.

**Y una fuga que ya ocurrió:** el ws1 (un cliente) tiene la **misma `ANTHROPIC_API_KEY`
que la agencia**, sembrada por `migrarEnvACredenciales()`. Rotarla también.

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

Al 16/09/2026 sigue abierto en las dos funciones (`lib/usuarios.ts:195` y `:224`). La
copia de la API de MaKo ya cuenta bien (`esUltimoAdminActivo`, solo `estado === 'activo'`).

**16/09/2026 — y un `rol_ws` null es admin para la sesión, pero no para el guard.**
`getRolWsEfectivo` resuelve `sesion.rolWs ?? 'admin'` (`lib/workspace.ts:239`). El guard,
en cambio, mira el literal por dos lados: `contarAdminsClienteActivos` cuenta
`.eq('rol_ws','admin')` (`lib/usuarios.ts:221-227`), y las rutas solo lo consultan si
`objetivo.rol_ws === 'admin'` (`app/api/equipo/route.ts:98`, `:121`, `:129`;
`dejariaClienteSinAdmin` en `app/api/admin/usuarios/route.ts:96`). Falla para los dos lados:

- **Un miembro con null se puede degradar, suspender o eliminar sin que el guard pregunte
  nada**, aunque sea el único admin efectivo del cliente. Entra y opera como admin, y el
  invariante no lo ve.
- **Degradar a un admin literal cuando el otro admin es null frena** con «Eres el único
  admin del cliente» sin serlo, porque el null no suma.

La copia de la API ya resuelve igual que la sesión (`esAdminEfectivo`,
`lib/api-mako/areas/equipo.helpers.ts:42-49`). El mismo literal elige además al dueño en
`emailDuenoWorkspace` (`lib/usuarios.ts:212`) y la fila del perfil en vista de cliente
(`lib/perfil.ts:68`): con un null, caen a la primera fila. **Sin medir:** si hoy hay filas
así (`count usuarios where rol='usuario' and rol_ws is null`). La medición de «Ningún guard
que mire el eje de workspace…» encontró a los usuarios no-admin con `'admin'` literal, pero
es anterior. **Regla:** un guard que protege un invariante de rol usa la MISMA resolución
de rol que la sesión.

**Vive en:** lib/usuarios.ts:192-198 y :221-227 · app/api/equipo/route.ts:98,121,129 · app/api/admin/usuarios/route.ts:88-99 · lib/workspace.ts:239 · lib/perfil.ts:68 · lib/api-mako/areas/equipo.helpers.ts:42-49 · *2026-07-02 ~auditoria-acceso-roles · 2026-09-16 api-mako-areas*

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

### Un guard BYOK que vive en UNA action no cubre la credencial: hay cinco caminos de guardado

El guard «la key de plataforma pegada como propia se rechaza» estaba bien escrito en el
server (`guardarZernioKeyAction`, app/instagram/actions.ts) — y era **bypasseable igual**,
porque `ZERNIO_API_KEY` también se guarda por la card de Zernio en /integraciones
(`/api/integraciones/credencial` `action:'guardar'`), por /metodo, por el onboarding y por
el copiador de datos-mau, y ninguno de esos caminos comparaba contra la key de plataforma.
El impacto no es solo cosmético: en lib/zernio.ts `cfg()` marca `byok: true` para
cualquier ws ≠ dueño con key «propia», y BYOK **saltea el aislamiento por profile** — 
`ensureProfile` guarda `profile_id NULL` y `profileIdEfectivo` resuelve el profile
**Default de la cuenta** → con la key de la agencia, eso son las cuentas y conversaciones
del profile Default de la plataforma servidas a un cliente.

Arreglado (corrida 2026-08-15) moviendo el guard al choke point:
`guardarCredencial()` en lib/credenciales.ts tira `KeyDePlataformaError` si un ws ≠ dueño
guarda una clave del set `BYOK_NUNCA_PLATAFORMA` con el valor exacto de la plataforma.
El route de /integraciones lo audita (`permitido:false`) y contesta 409; los demás caminos
lo surfean por sus catch. Es la misma regla del veto de Claude: **cerrar cuatro caminos
deja el quinto — el control va donde pasan todos**. Si aparece otra credencial con
semántica «key propia = modo distinto», va al set, no a su UI.

**Vive en:** lib/credenciales.ts (`BYOK_NUNCA_PLATAFORMA`, `KeyDePlataformaError`) ·
app/api/integraciones/credencial/route.ts · *corrida 2026-08-15 (auditoría tabs IG)*

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

### `notFound()` no tapa los METADATOS: el `<title>` se sirve igual

Un `export const metadata = { title: … }` **se resuelve aunque el guard de la página tire
404**. Los metadatos son un módulo aparte del render, así que el 404 corta el cuerpo y deja
el `<head>` puesto.

Medido el 2026-09-10 al montar `/analisis/trimestre` (el informe con los números de ws1
quemados, guardado con `esWorkspaceDueno()`): pidiéndolo con la sesión del **ws13** la
respuesta no traía **un solo dato del informe** —`grep` de `107,027`, `44,200` y `Mauricio`
dio 0— y el `<title>` decía, entero, «Trimestre junio–agosto 2026».

Un título no es un dato del negocio y aun así rompe la regla que el 404 viene a cumplir:
*a quien no le corresponde, no existe*. Ahí decía que la pantalla existe, de qué habla y de
qué trimestre. Y el modo de falla es el peor de los baratos: **el guard funciona**, así que
nada invita a mirar el `<head>`.

La cura es mover el título a `generateMetadata()` y correr ahí el MISMO chequeo:

```ts
export async function generateMetadata() {
  return (await esWorkspaceDueno()) ? { title: 'Trimestre junio–agosto 2026' } : {};
}
```

⚠️ **Y no se comprueba mirando la pantalla.** Un 404 y un 404 con el título puesto se ven
idénticos en el navegador — la pestaña de una ruta que no renderiza nadie no la mira nunca.
Se comprueba con `curl -b <cookie-de-otro-ws>` y un `grep '<title>'` sobre el HTML crudo.
Es la misma familia que [«Un flag de visibilidad protege la PANTALLA; la API hay que
cerrarla aparte»](../AGENTS.md): el guard cubre lo que dibuja, no todo lo que sale.

**Sin hacer:** la app **no tiene ningún `not-found.tsx`**, así que todo `notFound()` cae en
el default de Next y sirve, dentro del layout, una pantalla con el avatar y nada más — que
se lee igual que «se rompió». Son cuatro rutas hoy (`app/crm/[id]`, `app/crm/[id]/resumen`,
`app/admin/dev/[area]`, `app/analisis/trimestre`). Un `app/not-found.tsx` las cubre a las
cuatro de una.

**Vive en:** app/analisis/trimestre/page.tsx · lib/workspace.ts (`esWorkspaceDueno`) · *2026-09-10*


## Los audios de un cliente apuntaban a los binarios de OTRO: su lead escucharía a Mauricio presentándose

**Vive en:** `lib/clonar-config.ts` · `app/api/onboarding/route.ts:428` (`clonarConfigDelDueno`) ·
tabla `setting_audios` (`media_path`)

Medido el 25/09/2026 en producción, abriendo las filas que otra medición había citado como prueba
de lo contrario: `setting_audios` 25, 26 y 27 pertenecen al workspace 4, pero su `media_path`
empieza con `1/setting-audios/...` —la carpeta del workspace 1— y el transcript dice «te habla
Mauricio Bustos Eguía». Un lead de ese cliente escucharía al dueño de OTRO negocio presentándose
con su nombre. Sale del botón «Completar como Mauricio».

**La regla: un id por workspace no prueba aislamiento; lo que hay que mirar es a dónde APUNTA el
dato.** La medición que lo declaró resuelto verificó la numeración (ids de ws4) y dio por
verificada la sustancia (el binario). Es el mismo vicio que la refutación viene a cazar, y por
eso las citas se abren: `#25 ws4 → media_path 1/setting-audios/...`.

Queda como tarjeta #791. El path cruzado entre tenants es lo primero a cortar: el clon no puede
copiar binarios ajenos ni referenciar la carpeta de otro.

## «Vista de agencia»: el relevo que hay que leer ANTES de escribir una línea

Relevado el 27/09/2026, sobre el pedido de que Juanfran (Código Inmobiliario, ws13) pueda
entrar a SUS clientes desde `/customer-success`, con workspaces propios y una aprobación del
super-admin. No se escribió código: lo que sigue es lo que se midió, y cada afirmación está
verificada a mano contra el archivo (el panel de refutación murió por un error de API, así
que nada de esto pasó por un refutador — se verificó de a una).

**Vive en:** `proxy.ts` · `lib/workspace.ts` · `lib/auth-session.ts` · `app/admin/AdminView.tsx` · `app/_components/ImpersonationBanner.tsx`

### El diagnóstico obvio era el equivocado: no hay nada que REUSAR

«Que sea la misma funcionalidad que hay en admin» suena a reusar un endpoint. No hay
endpoint. El «Entrar como» de `/admin` es un **link** —un `<a>` a `/general?ws=N`,
`app/admin/AdminView.tsx:359`— y todo el permiso lo decide **una línea**, en el gate:

    if (sesion?.rol === 'admin') headers.set(WS_HEADER, String(ws));   // proxy.ts:164

Esa línea mira el rol **global** y **no mira qué workspace es**. O sea que la impersonación
de hoy no es una feature con permisos: es el bit de super-admin. No hay dónde enganchar una
aprobación, un registro ni un alcance, porque del lado del cliente no existe ningún acto —
existe una URL.

### Los dos modos de falla, y el probable NO es el leak

| Si a Juanfran se le da… | Qué pasa |
|---|---|
| `rol: 'usuario'` (lo prudente) | `proxy.ts:164` no pone el header → `getWorkspaceActual` devuelve `sesion.ws` (workspace.ts:145) → **la pantalla del «cliente» renderiza completa con los datos de la agencia**. Sin 403, sin error, sin nada roto. |
| `rol: 'admin'` (lo que funciona) | 154 call-sites de `getSesionAdmin()` en 63 archivos se le abren de una: `/admin` entero, los 13+ workspaces de la plataforma, crear otros super-admins, `/api/admin/impersonate` sin lista blanca, la cuenta de Meta y el gasto de IA de la agencia. |

El primero es el que se va a escribir sin querer, y es el síntoma exacto que AGENTS.md ya
tiene medido del 16/08: **no hay pantalla rota, hay una cuenta distinta**.

**Y no hay escalón intermedio.** `Rol = 'admin' | 'usuario'` (auth-session.ts:15), y un rol
inventado **la base lo acepta y el login lo rechaza**: `verificarToken` (auth-session.ts:195)
devuelve `null` para cualquier rol que no sea esos dos. Síntoma: la persona rebota a `/login`
para siempre, sin error y sin log. El compilador tampoco lo ve.

### Y la agencia entraría SIN CARTEL Y SIN SALIDA

`estaImpersonando()` (workspace.ts:230) devuelve `false` de entrada si el rol no es admin
global. De ahí cuelga todo: `/api/auth/me` manda `impersonando: false`, el
`ImpersonationBanner` hace `return null`, y no se dibuja ni la barra, ni el hueco
`--barra-agencia`, ni el botón «Salir de la vista».

Y aunque se dibujara, **la salida está cableada a `/admin` en tres lugares**
(`ImpersonationBanner.tsx:63` y `:67`, `OnboardingWizard.tsx:309`) — una ruta que está en
`SOLO_ADMIN` (proxy.ts:33) y que a Juanfran el propio gate le niega, dejándolo en `/inicio`.
AGENTS.md ya lo tiene escrito para este caso textual: «si la única salida vive adentro de una
pantalla condicional, no hay salida».

### El choque de nombre YA ESTÁ EN PRODUCCIÓN

`lib/api-mako/areas/equipo.run.ts:177` devuelve **`vista_de_agencia = impersonando`** en la
API que leen MaKo en la app, el doer de WhatsApp, `/api/v1` y la skill del cliente. Reusar el
nombre no rompe el compilador —es un campo de un `Record<string, unknown>` descrito en
prosa—: **hace que MaKo conteste mal**.

Y «agencia» hoy nombra siete cosas distintas: el rol global `admin`, la ruta `/agencia` (que
en realidad es el WhatsApp de MaKo), `/plan/agencia` (el board del super-admin), la barra de
impersonación y su token `--barra-agencia`, el «modo agencia» (que es estar impersonando),
`PanelAgencia.tsx` (que en realidad son dos botones destructivos) y la capa `superadmin`. Más
una tarjeta **«Panel de agencia + "Entrar como" un cliente» al 100%** en el board del dueño
(`app/plan/PlanBoard.tsx:111`), contra la que el pedido nuevo va a chocar y que el Perro va a
leer como duplicado de algo cerrado.

### El modelo de datos no puede expresar la pregunta

- **`workspaces` no tiene columna de padre.** La tabla son `id, nombre, slug, estado,
  created_at, updated_at` (mig 0054:29-36) más `capa` (0092). Las únicas alter posteriores son
  0071, 0092, 0096 y 0157. «Esta agencia es dueña de estos clientes» **no existe**.
- **`usuarios.workspace_id` es una columna escalar** (0054:74), y 0058:13 lo dice con todas
  las letras: «1 usuario = 1 workspace». No hay tabla de membresías. Cualquier diseño en el
  que el admin de la agencia «también esté» en los workspaces hijos choca con eso antes de
  escribir una línea de UI.
- **Un email = una cuenta en TODO MaKo**, y las cinco puertas de alta rechazan un email que ya
  exista en cualquier workspace (`admin/workspaces:57`, `admin/usuarios:120`, `equipo:75`,
  `equipo.run:584` y `:594`).

### `estado: 'pausado'` NO es una aprobación pendiente

Es la trampa que más barata parece. `workspaces.estado` **no bloquea el acceso a nada**:
medido, sus únicos lectores son los crons (`cron-workspaces.ts:91`, `crm-auto.ts:94` y `:464`,
`avisos-cola.ts:70`) y la UI de `/admin`. Un workspace «pausado» entra y opera normalmente.
Encima la columna **no tiene CHECK en la base** (0054:33): sólo la validan el route handler y
el tipo TS.

El único corte real de acceso es `usuarios.estado === 'suspendido'` (`lib/auth.ts:46`), y es
por PERSONA, no por workspace.

Y `propuestas` —el mecanismo de «un canal propone, una persona confirma»— está en
`TENANT_TABLES` (workspace.ts:106): una propuesta pertenece a UN workspace. Una aprobación del
super-admin sobre el alta de un cliente de una agencia es, por definición, **cross-workspace**,
así que no entra en ese molde sin romper el aislamiento.

### Las cinco trampas del enforcement, si igual se construye

1. **La lista de workspaces permitidos vive en el SERVER, adentro de `seguir()`**
   (proxy.ts:150) — que es el único lugar que borra el header entrante (línea 152). Un guard
   nuevo que devuelva `NextResponse.next()` a mano **reabre el IDOR**: cualquiera manda
   `x-mako-ws` y lee lo que quiera.
2. **Va en POSITIVO**: «los clientes de esta agencia son estos N», nunca «todos menos el 1 y
   el 9». Es la regla del Reset, que decía `ws !== OWNER_WS` en tres capas y se ofrecía adentro
   de todos los clientes reales.
3. **`proxy.ts:146` dice a propósito que NO se valida que el workspace exista**, «porque un id
   inventado no filtra nada». Ese razonamiento es cierto **sólo mientras el que entra puede ver
   todo igual**. Con agencias se cae: hay que consultar la base en cada request, o cachear el
   mapa agencia→clientes. Ése es el costo escondido del cambio.
4. **`getWorkspaceActual` (126) y `estaImpersonando` (228) tienen que mirar lo mismo y en el
   mismo orden** (el warning está en 224-227). Un tercer camino de entrada tocando sólo una deja
   la app mostrando los datos de un cliente con el chrome del otro.
5. **El rol que usa el PROXY sale del token FIRMADO AL LOGIN; el que usan las páginas sale de
   la base en cada request** (`lib/auth.ts:48`). Promover a alguien no le habilita el `?ws=`
   hasta que vuelva a entrar: «Entrar como» le va a parecer roto y nada lo explica. (Al revés
   es fail-closed, y está bien así.)

### Y «Clientes» son DOS pantallas sobre dos universos incompatibles

- **`/admin`** lista **workspaces**, y ahí ya vive «Entrar como».
- **`/customer-success`** lista **leads con `estado_lead='ganado'`**
  (`lib/clientes-ganados.ts:29-35`), y es la que tiene el modal de detalle que el dueño
  describe.

**Un lead no tiene workspace.** Poner «Entrar como» en la ficha de `/customer-success` exige
antes decidir cómo se ata un lead ganado a un workspace — hoy no hay ninguna columna que lo
haga, y ése es el primer trabajo, no la UI.

### Lo que quedó SIN hacer

Todo. No se escribió una línea: el pedido necesita dos tablas nuevas (la relación
agencia→cliente y la aprobación), una rama nueva en `proxy.ts:164`, extender
`estaImpersonando`, parametrizar la salida de `ImpersonationBanner`, atar lead↔workspace, y
un nombre que no sea `vista_de_agencia`. Y **no hay un solo test del aislamiento por `?ws=`**:
en `tests/` no hay ningún archivo que importe `proxy` ni `WS_HEADER`. La condición que decida
qué clientes ve una agencia tiene que vivir en un módulo **sin `server-only`** para poder
testearse, como ya se hizo con `exigirClienteDePrueba`.

⚠️ **Y con UNA sola agencia no se puede verificar.** Es el corolario 3 de `OWNER_WS`: con
Juanfran/ws13 solo, toda prueba da bien aunque el permiso esté cableado al número 13 en vez de
a una relación. La prueba honesta necesita una SEGUNDA agencia de mentira y comprobar que no
se ven entre sí.
