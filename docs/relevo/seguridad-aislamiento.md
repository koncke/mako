# Relevo — Seguridad y aislamiento entre clientes

**Ventana:** del commit `6785dc16` (05/10/2026 12:33) a `de64b5b7` (06/10/2026 15:58). 97 commits
en total; los de esta área son 8. Escrito el 06/10/2026 por la cuenta 1 al agotarse la cuota.

**Qué cubre:** que nada de un cliente llegue a otro — el workspace con el que sale un mensaje, un
mail, un link o un acuse; la herencia de configuración entre inquilinos; y la superficie que se
atiende sin sesión.

> **Lo primero:** en esta ventana aparecieron **siete fugas reales** (seis «cruces» entre clientes
> + una ejecución de server actions sin sesión). **Las siete están arregladas y pusheadas**, con
> guard. **Sólo una está verificada contra producción** — la de las server actions, que la verifiqué
> yo al cerrar. Las otras seis están fijadas por guards que leen el FUENTE, no el comportamiento.
> El detalle, abajo.

---

## 1. En qué quedó: lo hecho y desplegado

Todo pusheado (`git log origin/main..HEAD` vacío) y el último deploy de producción está en Ready
(`npx vercel ls` → `mako-7kbeubz4a…`, Production, Ready).

### 1.1 Los seis cruces entre clientes

El disparador fue un pedido literal de Martín del 06/10: *«es MUY importante que jamás se choquen
las notificaciones entre workspace, eso es gravísimo, altera toda la ciberseguridad y datos
sensibles de clientes»*. Se auditó la capa entera (8 caminos, 44 hallazgos, 12 sobrevivieron a dos
escépticos cada uno) y salieron seis familias. **Dos movían estado o identidad de un cliente a
otro**; las otras cuatro mandaban por el canal equivocado o no mandaban nada.

| # | El cruce | Qué pasaba | Commit que lo cierra |
|---|---|---|---|
| 1 | **Links sin `?ws=`** | 25 links en 13 archivos armaban la URL pegando `APP_BASE_URL` + la ruta a mano | `e307a6a6` (06/10 02:39), segunda mitad de `2d991183` (05/10 22:52) |
| 2 | ⚠️ **El acuse de un grupo de WhatsApp** | resolvía el workspace por la LÍNEA (`wsDeInstancia`), que es la de voz de MaKo mapeada al ws1: **todo «ok» de todo grupo de todos los clientes cerraba las insistencias de Mauricio** y marcaba SUS corridas de flujo | `626325a5` (06/10 02:51) |
| 3 | ⚠️ **El mail de `/compartir`** | el remitente salía del workspace EN CURSO, o sea del cliente que el super admin tenía abierto en la pestaña. Medido en producción: el ws11 tiene su `RESEND_API_KEY` y su `RESEND_FROM`, así que un mail de MaKo podía salir firmado por ese negocio y por su cuenta de Resend | `626325a5` |
| 4 | **El inbox de Chatwoot** | `cfg()` hacía `Number(inboxRaw ?? '3')`: sin la env declarada, todo salía por el inbox 3 (el de Mauricio). Y reusar una conversación abierta no miraba de qué bandeja era | `260bff7d` (06/10 03:01) |
| 5 | **El drenador de corridas** | `corridasVencidas` leía con `getTenantDb()`; el cron corre sin cookie, el workspace cae al dueño, y `flujo_corridas` es tabla de inquilino: **el «esperar 2 horas» de cualquier cliente que no fuera el ws1 esperaba para siempre**, sin un error | `260bff7d` |
| 6 | ⚠️ **La herencia del store de mensajes** | la base de la herencia era `OWNER_WS` (el ws1, que es Mauricio, un cliente): siete workspaces (5, 9, 10, 11, 14, 15 y 17) veían como texto de fábrica un `reporte-semanal` con **los números reales de Mauricio** — «$640 · 92 leads · CPL $6,9 · 4 cierres · CAC…» — dibujado como ejemplo en el editor de cada uno | `157a302a` (06/10 03:10) |

Cómo quedó cada uno, en una línea:

- **(1)** todo link pasa por `linkApp(ruta, ws)` / `linkPantalla`. El `ws` sale de `ctx.ws` y no de
  `wsEnContexto()`, porque el drenador de agendados (`lib/avisos-programados.ts`) resuelve sin
  envolver nada y ahí el contexto es `null`.
- **(2)** el acuse agrupa por jid y resuelve con `wsDeGrupoJid`, que pasó a exportarse desde
  `lib/mako-doer-in.ts` para que el acuse y el doer contesten lo mismo. **Fail-closed:** un grupo
  sin dueño reconocido no acusa nada.
- **(3)** el envío corre en `runWithWorkspace(await wsSuperAdmin())` con el `from` EXPLÍCITO, y el
  preflight se mudó adentro del mismo workspace (antes preguntaba `remitenteEsSandbox()` sobre el
  workspace en curso: verificaba otra cosa y se creía cubierto).
- **(4)** el inbox es `number | null` y se lee siempre por `inboxWA(c)`, que tira diciendo qué
  falta. Medido en producción antes de tocarlo: sólo ws1 y ws4 lo declaran, y son los únicos con
  token de Chatwoot — exigirlo no le cortó el canal a nadie.
- **(5)** la lectura de DESCUBRIMIENTO pasa a cruda (`getSupabaseServer()`) y lo que toca datos
  sigue adentro de `runWithWorkspace(ws)` en `retomarCorrida`. El guard fija las DOS mitades:
  sin la segunda, leer crudo sí sería un cruce.
- **(6)** la base pasa a ser `wsSuperAdmin()` — la plataforma, cuyo store hoy está vacío. Los
  clientes heredan el catálogo de fábrica y el ws1 queda como un inquilino más. Sin migración de
  datos y sin que ningún mensaje automático deje de salir.

**El guard de los seis:** `tests/cruce-notificaciones.test.ts` (seis tests) + `tests/link-con-workspace.test.ts`
(tres). La cosecha completa está en `docs/hallazgos-comunicacion.md` → «Que jamás se crucen los
mensajes entre clientes: seis familias (06/10/2026)», commit `04151008`.

### 1.2 Server actions sin sesión por una página pública — el único verificado en producción

`5b6426aa` (06/10 15:54). **Medido en local:** un `POST /login` con el header `next-action` de
`listConfirmacionesAction`, cuerpo `[]`, **sin cookie y sin Origin**, contestaba **200 con las
confirmaciones pendientes del CRM del ws1**: id, lead, nombre del lead, el cambio aplicado y el
`revert` para deshacerlo. Igual por `/privacidad`, `/terminos` y `/vsl`.

Tres cosas que solas no alcanzan:

1. el early-return de las rutas públicas en `proxy.ts` **se saltea el chequeo de Origin**, y sólo
   limitaba el MÉTODO en la lista de sólo lectura (`/compartido`);
2. **Next REENVÍA una server action a cualquier worker que la tenga** — el manifest decía que
   `listConfirmacionesAction` vivía en los workers de `/plan` y `/conocimientos`, y el POST a
   `/login` la ejecutó igual. O sea que por la puerta de una página pública entraba **cualquier**
   acción de la app;
3. sin cookie, `getWorkspaceActual()` cae al dueño (`OWNER_WS` = ws1, un cliente).

El arreglo, en dos capas: **toda página pública sólo se lee** (`esPublicaSoloLeer` en
`lib/rutas-publicas.ts`; todo lo que no es `/api/` acepta GET/HEAD/OPTIONS y nada más), y **las dos
acciones que monta el layout raíz exigen sesión adentro** (`haySesion()` en
`app/crm/mako-confirm-actions.ts`), porque su id viaja en todas las páginas y no pueden depender de
por qué ruta llegaron.

**VERIFICADO EN PRODUCCIÓN el 06/10/2026 al cerrar la ventana** (esto es nuevo: el hallazgo escrito
en `docs/hallazgos-seguridad.md` dice «no se verificó en producción»; ya está):

```
# contra https://hola-mako.com, con y sin header next-action inventado
POST /login        -> 405      POST /login + next-action        -> 405
POST /privacidad   -> 405      POST /privacidad + next-action   -> 405
POST /terminos     -> 405      POST /terminos + next-action     -> 405
POST /vsl          -> 405      POST /vsl + next-action          -> 405
POST /vsl-assets   -> 405
POST /compartido   -> 405      POST /compartido + next-action   -> 405
GET  /login        -> 200   (los controles siguen sanos)
POST /api/track/vsl -> 200   (las APIs públicas que escriben siguen escribiendo)
```

Las seis páginas públicas cortan por los dos caminos y nada de lo que tenía que seguir andando se
rompió. **Es lo único de esta área que está probado contra el runtime de producción.**

### 1.3 Lo que se cerró de paso

- **`/api/compartido/tarea` se fue de `PUBLICOS_ESCRITURA`** (`eba4f12f`): la ruta se había borrado
  el 26/09 con el programa viejo y la entrada seguía abriendo a POST una ruta que no existe. *Una
  excepción de escritura sin dueño es la que hereda la próxima ruta que alguien cree con ese
  nombre.* Hoy la lista tiene `/api/compartido/curso/progreso`, `/api/compartido/curso/tarea` y
  `/api/agente/lead`.
- **El aviso de línea caída ya no le llega al negocio que desvinculó su número a propósito**
  (`d23b3685`): `desconectar()` conserva la fila en «desconectado» y el vigilante nuevo la sondeaba
  igual, así que mandaba «🔴 Se cortó tu WhatsApp, reconectalo» a su grupo cada 24 h para siempre.
  Mensajes reales a personas reales sobre una decisión suya.
- **El reporte semanal ahora recorre los workspaces activos** y corre cada uno adentro del suyo
  (`c7510ddd`, decisión «b: solo el semanal para los clientes»). Un workspace roto no corta a los
  demás y `?dry=1` lista a quién le mandaría, enmascarado. Diario y horario **no** se tocaron.

---

## 2. Lo que quedó a medio hacer o sin verificar

### 2.1 ⚠️ Cinco de los seis cruces NO se verificaron contra producción

Los guards de los seis **leen el fuente**, no el comportamiento (`tests/cruce-notificaciones.test.ts`
lo dice en su encabezado: «Se lee el FUENTE sin comentarios»). Prueban que el código dice lo
correcto, no que el runtime lo haga. Medido por mí al cerrar: los 13 tests de los tres guards pasan
en HEAD.

```
node --import tsx --test tests/cruce-notificaciones.test.ts tests/link-con-workspace.test.ts tests/acciones-sin-sesion.test.ts
→ 13/13 pass, 0 fail (64 s; el guard de links se come 61 de esos 64 segundos)
```

El único de los seis con una medición contra producción es el **inbox de Chatwoot**, y es una
medición PREVIA (sólo ws1 y ws4 lo declaran, así que exigirlo no rompía a nadie), no una
observación del comportamiento después del deploy.

Lo que falta observar en producción, con el chequeo concreto:

| Cruce | Cómo se comprueba de verdad |
|---|---|
| El acuse de un grupo | mandar «ok» en un grupo de un cliente y ver que **no** se cierren insistencias del ws1 |
| El mail de `/compartir` | compartir material desde una pestaña parada en el ws11 y mirar el `From:` del mail que llega (debería ser el de MaKo, no el del cliente) |
| El drenador de corridas | buscar en `flujo_corridas` una corrida vencida de un workspace que no sea el 1 y ver que despierte |
| La herencia del store | abrir `/mensajes` con un workspace sin store propio (5, 9, 10, 11, 14, 15, 17) y confirmar que el ejemplo del `reporte-semanal` **ya no** trae los números de Mauricio |
| Los links con `?ws=` | abrir el botón «Verlo en MaKo» de un aviso de un cliente y mirar que la URL lleve su `?ws=` |

### 2.2 ⚠️ El reporte semanal multi-inquilino nunca corrió

`vercel.json` (HEAD): `"/api/cron/reporte-semanal"`, `"schedule": "20 14 * * 1"`. **Lunes.** El
cambio se desplegó el martes 06/10, así que **la primera corrida real es el lunes 12/10/2026 a las
14:20 UTC**, y es la primera vez que ese cron le manda algo a un cliente que no sea Mauricio.
Medido en el commit: el WhatsApp del reporte sale por el Chatwoot del workspace y sólo el ws1 lo
tiene, así que a los clientes les llega **por mail**.

**Antes del lunes 12/10 conviene correrlo con `?dry=1`** y mirar la lista de destinatarios
enmascarada. Si sale mal, salen mails de verdad a negocios de verdad.

### 2.3 Lo que sigue sin guarda propia

- **`deleteLeadAction` y `exportLeadsAction` no miran la sesión.** Verificado en HEAD:
  `app/crm/actions.ts:968` (`deleteLeadAction`) entra directo a `deleteLead(id)`; `:1537`
  (`exportLeadsAction`). Hoy están cubiertos **por el proxy** —sin sesión ya no llegan— pero no
  tienen su propio corte, y con una sesión de CUALQUIER rol corren acotadas a su workspace. Nunca
  se hizo el barrido de las otras 51 acciones de ese archivo.
- **Los `?? OWNER_WS` escritos a mano siguen ahí.** Medido en HEAD:
  `git grep -c "?? OWNER_WS" HEAD -- 'lib/*.ts' 'app/**/*.ts'` → **53 ocurrencias en 37 archivos**.
  Cada uno es un lugar donde un workspace nulo termina leyendo o escribiendo en el del ws1, que es
  un cliente. Es la raíz común de los cruces 2, 5 y 6 y de lo de `/login`.
- **`docs/auditoria-aislamiento-workspace.md` no se tocó en toda la ventana** (verificado:
  `git log 6785dc16..HEAD -- docs/auditoria-aislamiento-workspace.md` vacío). Es el mapa de qué se
  scopea por workspace y qué no; los seis cruces de esta ventana no están reflejados ahí.

### 2.4 ⚠️ Las caras de los leads viven en un bucket PÚBLICO

`0418a6ab` (06/10) empezó a copiar la foto de perfil de WhatsApp de cada lead a
`avatars/leads/<ws>/<lead>.jpg`, y la sirve con **`getPublicUrl`** (`lib/fotos-contacto.ts:86`).
El bucket `avatars` es público por construcción: `app/api/perfil/avatar/route.ts:47` lo crea con
`{ public: true }`.

**Medido por mí el 06/10:** un GET anónimo a
`<SUPABASE_URL>/storage/v1/object/public/avatars/leads/1/999999999.jpg` contesta
`404 {"error":"not_found","code":"NoSuchKey"}` — o sea *«el objeto no está»*, no *«el bucket no es
público»*. La ruta se lee **sin ninguna credencial**; lo único que protege la foto es adivinar dos
enteros chicos (`<ws>` va de 1 a ~17, `<lead>` es el id de la fila). **No bajé ninguna foto real a
propósito.**

El relleno inicial ya copió 32 fotos en el cliente más grande y 11 en otro. La cara de una persona
que le escribió a un cliente es un dato personal de un tercero: esto no es un cruce entre
workspaces (nadie ve el panel de otro), pero sí superficie pública nueva que nadie marcó como tal.
Vive en `lib/fotos-contacto.ts` y `app/api/cron/fotos-contacto/`.

### 2.5 ⚠️ Hay trabajo SIN COMMITEAR de otra sesión justo encima del proxy

Al cerrar, el árbol compartido tenía modificados —**por otra sesión, no por mí; los dejé donde
estaban**— archivos que son el borde de esta área:

- `proxy.ts`: una **rama nueva** antes del chequeo de Origin, `decidirRutaAlumno(pathname, método, conAccion)`.
- `lib/rutas-publicas.ts`: `RUTA_ALUMNO = '/mi-curso'` y esa función, con match EXACTO y sólo
  GET/HEAD, **a propósito fuera de `PUBLICOS`** (porque esa página SÍ lee una cookie, y estar en
  `PUBLICOS` significa «no lee cookie»).
- `lib/workspace.ts` y `lib/tablas-de-inquilino.ts`: `lead_funnel` agregada a las tablas de
  inquilino (mig 0207).
- Sin trackear: `lib/alumno-sesion.ts`, `lib/alumno-acceso.ts`, `app/mi-curso/`,
  `app/api/compartido/curso/entrar/`, `supabase/migrations/0206_curso_invitacion.sql`, `0207_lead_funnel.sql`,
  `tests/alumno-sesion.test.ts`.

**Por qué importa para esta área:** es una **cookie de sesión nueva** (`mako_alumno`, firma propia
`al1.<ws>.<lead>.<version>.<exp>.<firma>`, 30 días) para un cliente del cliente, y el comentario de
`lib/alumno-sesion.ts` explica por qué el alumno **no** puede recibir `mako_session`: medido en el
relevo de auth del 06/10, una sesión válida pasa por todas las rutas que no son `/admin`,
`requireRolWs` manda un rol desconocido a `/crm`, `getRolWsEfectivo` cae a `'admin'`, y 98 APIs más
las 53 acciones de `app/crm/actions.ts` no miran el rol. **Con una fila en `usuarios`, el alumno
leía el CRM de Mauricio.**

**Lo que el que entre tiene que mirar:** si ese trabajo se commiteó, revisar que la rama de
`/mi-curso` siga siendo exacta y sólo de lectura, y que `resolverAcceso` se consulte en CADA pedido
(la firma sólo dice quién era el alumno el día que entró). Si no se commiteó, **el riesgo es que
una sesión futura pise `proxy.ts` o `lib/rutas-publicas.ts` y se lleve el corte de `esPublicaSoloLeer`
con ella** — es el archivo más delicado del repo y hoy está sucio.

### 2.6 Lo más chico, pero anotado

- **La tabla `notificaciones` nunca se aplicó en producción** (anotado el 23/09, sigue así). Un
  aviso que no sale por WhatsApp no queda registrado en ningún lado.
- **Cuatro workspaces no tienen ningún canal de aviso.** No es un cruce —no les llega nada a ellos
  ni a otros— pero es la otra mitad de «que cada uno reciba lo suyo».

---

## 3. Las trampas del área

**1. Un guard verde no quiere decir que el agujero esté cerrado — quiere decir que el guard no lo
ve.** `tests/link-con-workspace.test.ts` existía desde el 05/10 y daba **verde sobre los 25 links
que seguían rotos**. Era ciego a dos formas que compilan igual: la ruta guardada en una variable
(`${APP_BASE_URL}${ruta}`, que es justo la forma del resolvedor de los seis `{{link_*}}` y de los 18
links de la API de MaKo) y la URL armada en una `const` de módulo. Y **eximía por ARCHIVO**: una
excusa legítima en una línea dejaba pasar todo lo demás del archivo. Las tres correcciones valen
para cualquier guard que busque un patrón en el fuente:

- **Se enumera lo PERMITIDO, no lo prohibido.** La lista que se mantenía era la de pantallas de
  inquilino (`DE_INQUILINO`, 7 rutas), que **crece con el producto y envejece sola** — faltaban
  `/integraciones`, `/inicio`, `/ads-manager`, `/closing`, `/mako`, `/instagram` y `/experimentos`.
  Ahora se mantiene la lista de rutas PÚBLICAS, que no se movió en seis meses.
- **Una ruta en una variable es una FALLA, no un «no sé».** Si el guard no puede leer del fuente a
  dónde va, no puede autorizarlo.
- **Se exime por BLOQUE** —la función con su cierre real— y nunca por archivo.

**2. Un `assert.match` sobre el archivo entero encuentra lo que el archivo dice de sí, no lo que
hace la función.** La cuarta rotura de `tests/cruce-notificaciones.test.ts` **pasó en VERDE la
primera vez**: el `assert.match` del `runWithWorkspace` se satisfacía con el del *preflight* de más
arriba en el mismo archivo. Ahora se exige adentro del bloque de `invitar`, con `bloque(src, desde,
hasta)` y el cierre real. Si no se prueba rompiéndolo, un guard así afirma cualquier cosa.

**3. Un rojo cuyo nombre dice «landing» puede ser de un archivo que no se llama así.** `cad249b3`:
`tests/landing-optin.test.ts` falló y se reportó «es un rojo de HEAD, del commit `b42c5194`». Las
dos cosas eran falsas. El assert hacía `leer('../app/api/cron/tracking-vigilante/route.ts')`, y
**ese** archivo lo estaba editando una tercera sesión. La regla de la casa («lo PRIMERO es
`git status --short` de los archivos que el error nombra») no cubre este caso: **un guard sobre el
fuente pone su propio nombre en el error, nunca el del archivo que mira**. Aplicarla al nombre que
aparece es preguntar por el archivo equivocado, y el resultado no es «no sé»: es una acusación
contra el commit de otra sesión. El comando correcto: `grep` de qué lee el test, y
`git show HEAD:<ese archivo>`. Si HEAD lo tiene y el disco no, no hay nada que arreglar: hay
alguien tipeando.

**4. El diagnóstico obvio de lo de `/login` era el corto, y estaba mal.** Parecía «cortar el header
`next-action` en las rutas públicas». Next **también** procesa una acción que llega como POST de
formulario (multipart o urlencoded) con `$ACTION_ID_<id>` en el cuerpo, **sin header** — es el
camino de los formularios sin JavaScript. Ese camino no se pudo medir ejecutándolo (una acción de
lectura no devuelve su resultado por ahí: Next re-dibuja la página), pero existe, y un corte por
header lo dejaba abierto. Por eso el corte es por MÉTODO.

**5. `OWNER_WS` no es la plataforma: es un cliente.** Es la regla que produjo cuatro de las siete
fugas de la ventana. El ws1 es Mauricio. Cuando no hay cookie el workspace efectivo es el del
dueño — por contrato explícito de `lib/workspace.ts`, que es lo correcto para un cron o un webhook
y es exactamente lo que convierte cualquier olvido en una fuga de un cliente real. **La plataforma
es `wsSuperAdmin()`**, y su store de mensajes está vacío a propósito.

**6. La pregunta de aislamiento es por el WORKSPACE, no por el usuario.** El super admin **sigue
siendo admin** cuando entra al workspace de un cliente con `?ws=N`: `getSesionAdmin()` contesta
«¿quién mira es admin?», que es otra pregunta. Lo que hay que preguntar es
`wsActual === wsSuperAdmin()`. (Hallazgo de agosto, pero es el molde del cruce 3 de esta ventana: el
`from` del mail salía del workspace de la pestaña.)

**7. El síntoma «este lead no es de esta cuenta» sobre un lead propio no era el chatbot cruzando
workspaces.** Eran los links de los avisos sin `?ws=`: el aviso llega al teléfono con la app parada
en otro workspace y la guardia de agosto contesta eso. Medido por los escépticos: el `?ws=` viaja
**únicamente** en la URL, así que un link pelado abierto desde WhatsApp **no hereda la pestaña** —
abre una pestaña nueva y el workspace lo resuelve la cookie. Para un cliente normal eso aterriza en
SU propio workspace y no puede ver datos de otro: `proxy.ts` sólo honra el parámetro con sesión
firmada de admin. **El cruce aparece para quien tiene acceso a MÁS de un workspace** (el super
admin con su cookie de impersonación de 12 h, una agencia con cartera). Es un destino que falta, no
una fuga de datos — pero se arregló todo igual, porque es lo que produce el síntoma.

**8. Hay un redirect_uri que NO se puede tocar.** El `redirect_uri` del OAuth tiene que coincidir
carácter por carácter con el registrado en el proveedor: agregarle el `?ws=` lo **ROMPE**. Está
documentado en la lista de públicas del guard, con su motivo.

**9. Sin un corte, lo que falla es el silencio.** Los seis cruces compartían el mismo modo de
falla: **no daba error**. El acuse cerraba insistencias ajenas devolviendo «ok». El inbox 3 mandaba
el WhatsApp por el canal de otro y el envío volvía «ok». El drenador no despertaba una corrida y
«no salió» es indistinguible de «no había nada que avisar». El mail de `/compartir` salía válido las
dos veces — *por eso nadie lo ve*.

---

## 4. Qué espera una decisión de Martín

**4.1 Los reportes diario y horario siguen siendo sólo del ws1.** El 06/10 Martín decidió «b: solo
el semanal para los clientes» y eso ya está implementado (`c7510ddd`). Los otros dos crons
(`/api/cron/reporte-diario` a las 14:10 UTC, `/api/cron/reporte-horario` cada hora) siguen leyendo
el interruptor, el teléfono y el mail del ws1 sin envolver nada, así que **las preferencias de
notificación de los demás clientes son decorativas para esos dos caminos**: la pantalla los deja
configurar y nada los lee. Opciones: (a) dejarlo así y sacar los dos de la lista que ve el cliente
en `/mensajes`, para no prometerle algo que no sale; (b) multi-inquilinizarlos como el semanal; (c)
dejarlo como está y anotar que es a propósito. Vive en `app/api/cron/reporte-diario/route.ts`,
`-horario` y `lib/perfil.ts`.

**4.2 La foto de los leads en un bucket público (§2.4).** Opciones: (a) dejarlo (es lo que hay hoy:
la URL es pública y la protege la dificultad de adivinar `<ws>/<lead>`); (b) pasar ese prefijo a
privado y servir la foto por URL firmada, como ya hace el portal del curso; (c) dejar el bucket
público pero poner un nombre no adivinable (un hash en vez del id del lead). La (c) es la más
barata y cierra el único riesgo real, que es la enumeración.

**4.3 El barrido de las server actions sin guarda propia (§2.3).** Son 53 acciones sólo en
`app/crm/actions.ts`, más las de otros archivos. Opciones: (a) no hacer nada, el proxy ya corta sin
sesión; (b) un guard de fuente que exija que toda `export async function …Action` empiece
verificando sesión, con una lista blanca en positivo para las excepciones; (c) un barrido a mano,
que envejece. **La (b) es la única que no envejece**, y es el molde que ya funcionó en los dos
guards de esta ventana.

**4.4 Los 53 `?? OWNER_WS`.** Es la raíz común y es trabajo grande. Opciones: (a) dejarlos y
confiar en los guards puntuales; (b) hacer que `OWNER_WS` deje de ser el fallback y que un workspace
sin resolver **tire**, migrando los 53 call-sites de a tandas (fail-closed, pero puede romper crons
que hoy andan); (c) partir la diferencia: fail-closed sólo en lo que ESCRIBE o manda un mensaje, y
dejar el fallback en lo que sólo lee. Esto es una decisión de arquitectura, no un arreglo.
