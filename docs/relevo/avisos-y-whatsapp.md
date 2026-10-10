# Retomar: avisos, reportes, WhatsApp y Chatwoot

**Ventana que cubre:** del commit `6785dc16` (05/10/2026 12:33) a `9862c146` (10/10/2026 18:59).
**Reemplaza** al briefing de esta misma área del 06/10/2026 (commit `035931f7`). Lo que ese
briefing decía y hoy es falso está en la sección 6, con el commit que lo cambió.

**Qué es esta parte del producto**, para quien nunca la vio: son los mensajes que MaKo manda
**sola**, sin que nadie apriete nada. Tres familias que se confunden y no son lo mismo:

| Familia | Qué es | Dónde se configura | Quién lo manda |
|---|---|---|---|
| **Reportes** | el resumen del negocio (horario, diario, semanal) | `/configuraciones` → Notificaciones | `app/api/cron/reporte-*` |
| **Avisos** | ~65 mensajes de catálogo: «se cayó tu WhatsApp», «tu cuenta de Meta está frenada», «venció la cuota de un cliente» | la tab `/mensajes` | `emitirDelCatalogo` (`lib/avisos.ts`), llamado desde crons y webhooks |
| **Automatizaciones** | las secuencias que le escriben a un LEAD | la tab `/automations` (hasta el 09/10/2026 se llamaba `/chatbot`) | `app/api/cron/nutricion*` |

Las tres salen por WhatsApp, y **el WhatsApp del producto es UNO solo desde el 09/10/2026**.

---

## 0. El vocabulario mínimo (sin esto no se entiende nada de abajo)

- **MaKo** es el producto. Es de **Martín Koncke**. Es multi-inquilino: cada negocio es un
  *workspace* («ws»). ⚠️ **La constante `OWNER_WS` vale 1 y el ws1 NO es el dueño: es
  Mauricio Bustos, un CLIENTE** (el primero que hubo). La plataforma es `wsSuperAdmin()`, que
  resuelve al **ws9 = Martín Koncke**.
- **Los 11 workspaces, medidos el 10/10/2026 a las 22:04 UTC** (`workspaces`, por la API REST
  con la service role, sólo lectura): ws1 Mauricio Bustos · ws3 Cliente de Prueba · ws4 Cliente
  de Diseño · ws5 Prueba real - Ananda (**pausado**) · ws9 Martin Koncke · ws10 Leandro Tejado ·
  ws11 Leila · ws13 Codigo Inmobiliario · ws14 P2P Consulting · ws15 Brigitte Eberlin · ws17
  joan prueba. **Diez activos**, ws5 pausado (los crons no lo iteran).
- **Había DOS WhatsApp y quedó UNO:**
  - **El no oficial («Evolution»)**: un WhatsApp Web automatizado. El negocio escanea un QR y
    su número queda conectado. No tiene ventana de 24 h ni plantillas aprobadas; el riesgo es
    que **baneen la línea**. Es el que usa TODO el producto.
  - **El oficial («Chatwoot» / WABA)**: la API oficial de Meta, con plantillas aprobadas y
    ventana de 24 h. **Se borró el 09/10/2026.** No existe más.
- **La «voz de MaKo»**: una línea de WhatsApp propia de la plataforma, distinta de la de cada
  cliente. Con ella MaKo escribe en el grupo «MaKo <> cliente» de cada negocio. **Por ahí
  salen los AVISOS** — y por eso un aviso de «se cayó tu WhatsApp» puede llegar aunque el
  WhatsApp del cliente esté muerto: viaja por otro canal.
- **Todo está pusheado y desplegado.** `git log origin/main..HEAD` vacío; `vercel ls` el
  10/10 a las 22:15 UTC: el último deploy de producción en **Ready** tenía 9 minutos y había
  otro en **Building** (de otra sesión, que estaba pusheando en ese momento).

**Todas las mediciones de este documento se tomaron el 10/10/2026 entre las 22:00 y las 22:20
UTC**, contra la base de producción por la API REST, sólo lectura.

---

## 1. En qué quedó

### 1.1 ⛔ Chatwoot se borró. El WhatsApp oficial no existe más

Pedido de Martín, 09/10/2026, textual: *«Elimina de todos lados la integración con Chatwoot,
que no exista más. Guardalo en privado, por si en un futuro queremos volver a utilizarla»*, y
más tarde el mismo día: *«terminalo todo»*.

Estaba en **122 archivos**. Se hizo en dos pasos y seis commits:

| Commit | Qué saca |
|---|---|
| `2375d53a` | el **interruptor**: `CHATWOOT_APAGADO` en `cfg()`, por donde pasaba toda llamada |
| `99246cff` | la **bandeja oficial** de `/whatsapp` entera y 13 rutas de API |
| `dae6b3b4` | los **consumidores de `lib/`**: borradores, etiquetas del CRM, reportes, webhooks, teléfonos |
| `886890f3` | los **registros** de la integración |
| `f98778f7` | `lib/chatwoot.ts` de **990 líneas a un cascarón**, y el guard que fija que no vuelva |
| `c09e16ad` | la **puerta vieja** que seguía pidiendo Chatwoot (ver la trampa 5.1) |

Lo que hay que saber para escribir código hoy:

- **El código entero está en la etiqueta de git `archivo/chatwoot-2026-10-09`**
  (apunta a `91136db8`). Para leerlo: `git show archivo/chatwoot-2026-10-09:lib/chatwoot.ts`.
  **Las credenciales de los clientes NO se borraron de la base.**
- **`lib/chatwoot.ts` sigue existiendo como CASCARÓN** (158 líneas, cero pedidos HTTP, cero
  credenciales). `chatwootConfigurado()` devuelve `false` para todos y cada firma contesta lo
  que contestaba con el interruptor apagado. **No se borró todavía** porque lo importan
  archivos que la rama local `wip/api-acciones-0910` tiene a medio cambiar (`app/crm/actions.ts`,
  `lib/nutricion.ts`, `lib/api-mako/areas/whatsapp.*`) más `lib/meta-templates.ts`. Cuando esos
  dejen de importarlo, se borra entero. La lista exacta está en la cabecera del archivo.
- **Código nuevo no importa `lib/chatwoot.ts` ni nombra Chatwoot.** `tests/sin-chatwoot.test.ts`
  fija en positivo quién puede importarlo y quién puede nombrarlo; **las listas sólo se achican**.

### 1.2 Los reportes salen SÓLO por email — `90c5e313` (10/10 13:12)

Borrar Chatwoot dejó al reporte sin por dónde salir por WhatsApp (salía como texto libre
dentro de la ventana de 24 h que abría la plantilla `reporte_mako`). Decisión de Martín,
10/10/2026: **«Apagar WhatsApp en los reportes»** — y no mandarlo al grupo de MaKo.

Vive en **una constante**: `REPORTE_POR_WHATSAPP = false` (`lib/mensaje-canales.ts:36`). La
leen los **tres** lugares que decidían: el lienzo y el interruptor de un reporte
(`canalesDeMensaje`, `guardarCanalDeMensaje`) y el cron (`decidirReporte`,
`lib/reporte-destino.ts:64`). El lienzo ya no dibuja la tarjeta de WhatsApp de un reporte ni
ofrece prenderla. Si algún día vuelve, se cambia ahí y los tres lo siguen.

### 1.3 ⚠️ El primer reporte semanal multi-cliente **TODAVÍA NO CORRIÓ**: sale el lunes 12/10 a las 14:20 UTC

El cron sigue agendado `"20 14 * * 1"` (`vercel.json`), o sea **lunes 14:20 UTC**. Este
documento se escribió el **sábado 10/10/2026**, así que la primera corrida real de la versión
que itera inquilinos (`c7510ddd`, 06/10) **no ocurrió ninguna vez**: el lunes anterior (05/10)
ese código no estaba desplegado. **La próxima ventana de ejecución es el lunes 12/10 a las
14:20 UTC.**

**A quién le va a llegar, medido el 10/10 a las 22:05 UTC** (`notification_prefs`,
`notif_emails`, `notif_telefonos`, `user_email`, `user_telefono` de `app_settings`, pasados a
mano por `destinosDelReporte` + `decidirReporte`):

| Workspace | Qué pasa el 12/10 | Por qué |
|---|---|---|
| ws1 Mauricio | **sale** a `tejadomartin@gmail.com` | sin lista propia → cae al `user_email` |
| ws9 Martín | **sale** a `equipo@hola-mako.com` | lista propia |
| ws10 Leandro | **sale** a `tejadomartin@gmail.com` | sin lista → `user_email` |
| ws11 Leila | **sale** a `hola@leilafittipaldi.com` | lista propia |
| ws13 Código Inmobiliario | **sale** a `codigoinmobiliarioia@gmail.com` | lista propia |
| ws14 P2P | **sale** a `p2pconsultingg@gmail.com` | sin lista → `user_email` |
| ws3, ws4, ws17 | **salteado** (`sin_destinatario`) | no tienen ni email ni teléfono cargado |
| ws15 Brigitte | **salteado** (`sin_destinatario`) | tiene **dos teléfonos y `notif_emails` vacío**, y el WhatsApp está apagado |
| ws5 Ananda | no se itera | pausado |

⚠️ **Dos cosas de esa tabla que conviene mirar antes del lunes:**
1. **ws15 no recibe NADA** y antes de apagar WhatsApp tenía dos teléfonos: el único canal que
   tenía se apagó. No es un bug — es la consecuencia de la decisión, y nadie se la contó.
2. **ws1 y ws10 comparten destinatario** (`tejadomartin@gmail.com`): el reporte semanal del
   negocio de Mauricio va a una dirección que también es la de otro workspace. **Sin verificar
   de quién es esa casilla.** Es un dato de la base del ws1, no de nuestro código.

**La verificación barata, y no manda nada:** `GET /api/cron/reporte-semanal?dry=1` (con el
`Bearer CRON_SECRET`) lista a quién le mandaría con los destinos enmascarados, sin armar el
reporte. Admite `&ws=N`. Vive en `app/api/cron/reporte-semanal/route.ts`.

**Los reportes diario y horario siguen siendo SÓLO del dueño, a propósito**: verificado por
grep el 10/10 — cero `runWithWorkspace` y cero `listarWorkspaces` en
`app/api/cron/reporte-diario/route.ts` y `-horario`. Hay un test que lo fija.

### 1.4 La línea caída se puede apagar, y cuando vuelve sale un «volvió» — `9da594a2` (09/10 13:45)

Decisión de Martín al cerrar el Chatbot: **«las dos cosas»** (eran las decisiones 1 y 2 del
briefing del 06/10). Qué quedó:

- **`wa-desconectado` y el nuevo `wa-reconectado` entran a `AVISOS_DEL_CLIENTE`**
  (`lib/avisos-catalogo.ts`): el negocio los ve en su lista de `/mensajes` y **los puede
  apagar** — incluido el que le dice que su canal está muerto.
- **El «volvió» sale sólo si la caída SE AVISÓ.** `decidirLinea` (`lib/linea-vigilancia.ts:69`)
  devuelve `volvio` únicamente si hay marca de avisado. Un corte que se recuperó entre dos
  corridas no tiene nada que desmentir y se limpia en silencio; una línea que el negocio
  desvinculó a propósito tampoco «vuelve».
- **Las marcas se limpian ANTES de mandar el «volvió» y aunque no llegue** (al revés que la
  caída): dejarlas puestas haría que la próxima caída se avise sin la segunda medición que la
  confirma. Dedup con clave propia (`volvio:<línea>`), para no compartir ventana con el «se cortó».
- Texto corto y **sin link**: `🟢 Volvió tu WhatsApp (+52…). Por ese número ya entran y salen
  mensajes otra vez.` No hay nada que hacer.

### 1.5 ✅ Y el vigilante de líneas **YA MANDÓ AVISOS REALES**: el 09/10 en el ws11 (Leila)

Esto es lo más importante que cambió respecto del briefing del 06/10, que decía que el
vigilante no había mandado nada. **Medido el 10/10 a las 22:05 UTC**, en `app_settings` del ws11:

| Clave | Valor |
|---|---|
| `mako.aviso.last.wa-desconectado:nPGkJg1fgbOZ` | `2026-10-09T15:00:32.328Z` |
| `mako.aviso.last.wa-reconectado:ZiYhSJOJj739` | `2026-10-09T18:40:31.405Z` |
| `wa.linea.caida.desde.mako_ws11` | `""` (limpiada) |
| `wa.linea.caida.avisado.mako_ws11` | `""` (limpiada) |

Los sufijos son el hash de la clave de dedup (`keyEspaciado`, `lib/espaciado.ts:42`:
sha1 base64url, 12 caracteres). **Verificado ejecutándolo**:
`sha1('mako_ws11') → nPGkJg1fgbOZ` y `sha1('volvio:mako_ws11') → ZiYhSJOJj739`. O sea que esas
dos marcas son de la línea `mako_ws11`, el WhatsApp de Leila.

**La secuencia completa, leída de esos cuatro valores:** la línea se cayó → el vigilante fijó
el «desde» → confirmó la caída y emitió **«se cortó tu WhatsApp» a las 15:00:32 UTC del
09/10** → la línea volvió → limpió las marcas y emitió el **«volvió» a las 18:40:31 UTC**, 3 h
40 min después. El aviso de «volvió» salió **el mismo día en que se desplegó** (`9da594a2`,
09/10 13:45 -0300 = 16:45 UTC).

⚠️ **Qué prueba esa marca y qué NO.** `reclamarEspaciado` la escribe **antes** del envío
(`lib/avisos.ts:174`) y **después** del interruptor del cliente (que corta en `:148`). Así que
prueba que el aviso se **emitió** —el interruptor estaba prendido y el dedup no lo descartó— y
**no** que el WhatsApp haya llegado al grupo. Para eso haría falta el feed, y el feed no
existe (ver 3.1).

**ws13 (Código Inmobiliario) no tiene ninguna marca, y es correcto**: su `ultima_conexion_at`
es `null` → nunca vinculó un número → una línea que nunca se vinculó no «se cae»
(`decidirLinea`). Está enganchado al cron `alerta-critica`, cada 10 minutos, **después** de la
voz de MaKo (`app/api/cron/alerta-critica/route.ts:55`).

### 1.6 Mensajes de MaKo: la base de la plataforma se separó del ws9 — `7ad16c8a` (10/10 13:18)

Lo encontró la revisión del ws9. **El store de mensajes del ws9 ERA la base que heredan
todos**, así que lo que Martín cambiaba en «MaKo en WhatsApp» de su propio negocio (prender,
apagar, un texto, una cadencia) **le llegaba a todo cliente que no lo hubiera tocado**, sin
que ninguna pantalla lo dijera. Decisión de Martín: **«Separar la base»**.

- La base vive ahora en `mako.plantillas.base` **del workspace de la plataforma**, y sólo la
  edita `/mensajes` desde ahí (`conLaBaseDeLaPlataforma`, `lib/plantillas.ts`).
- El «MaKo en WhatsApp» del ws9 edita **su** store, y hereda la base como cualquier negocio.
- **Medido antes de hacerlo: las dos claves estaban vacías, no hubo nada que mudar.**
  Re-verificado el 10/10 a las 22:05: `mako.plantillas.base` **no tiene ni una fila**, y
  `mako.plantillas.store` existe en ws1, ws3, ws4 y ws13 — **no en ws9**. O sea que la fuga
  era posible y nunca ocurrió.

Es el tercer arreglo de la misma familia: el 06/10 (`157a302a`) la base había pasado de
`OWNER_WS` (el ws1, Mauricio) a `wsSuperAdmin()` (el ws9); ahora pasó del store del ws9 a una
clave propia.

### 1.7 El compare-and-set de los mensajes programados era decorativo — `921923b1` (07/10 01:42)

`drenarProgramados` (`lib/avisos-programados.ts`) avanzaba la fila con
`.eq('proxima_at', <lo leído>)` y **seguía de largo sin mirar cuántas filas había tocado**. Si
otra invocación del mismo tick ya la había avanzado, el update tocaba **cero filas sin error**
y el aviso salía igual: dos ticks mandaban dos veces. Ahora hace `.select('aviso_id')` y
`if (upErr || !tocadas?.length)`. Su test fijaba la presencia del `.eq`, o sea la mitad que
estaba bien; ahora exige las dos (probado rompiéndolo: 27/1, restaurado 28/0).

### 1.8 `/whatsapp`: una sola bandeja, un solo composer, y tres bugs de la nota de voz

- **`aed2a22a` (08/10)** — Pedido de Martín: *«que sea un editable con la interfaz tipo
  WhatsApp que ya creamos… Copialo tal cual»*. Había **tres copias del composer**; ahora hay
  una pieza, `app/whatsapp/_shared/ComposerWhatsApp.tsx`, más `BurbujaHilo.tsx` (el render de
  un mensaje), usadas por `ChatHilo`, `EmpresaInbox` y la tarjeta del lienzo de `/automations`.
- **`2522cd55` (08/10)** — «+ Agregar al CRM» deja **elegir el producto**. Salió de un audio de
  Leila (ws11): *«tengo a Nora Ricardi, ya la agregué al CRM. Pero… ella está en marca
  personal. Primero de por sí me entra al funnel principal»*. Medido ese día: los 6 leads que
  subió desde WhatsApp nacieron en el embudo principal y a los 6 los movió a mano.
- **`83d9147b` (10/10)** — el peor: grabar una nota de voz en el chat del lead A, apretar ✓,
  tocar al lead B y apretar ➤ **mandaba la nota al lead A** con la pantalla mostrando a B. La
  sesión de voz guarda el `onSend` del render en que se apretó el 🎤. Se arregló con
  `key={selConv.chatJid}` en el composer de `EmpresaInbox`, como ya hacía `ChatHilo`.
- **`b09d6573` (10/10)** — tocar 🗑 o ✓ **mientras el navegador pide el micrófono** dejaba el
  micrófono grabando sin ninguna barra, sin salida hasta desmontar.
- **`5cbea12f` (10/10)** — `WhatsAppApp` importaba `useRouter` de `next/navigation`: el rebote
  del deep link viejo perdía el `?ws=` y te dejaba **mirando otra cuenta**. Pasa al `useRouter`
  de `@/app/_ui/Link`.

### 1.9 El motor corre sin WhatsApp ni email cuando lo que manda es Instagram o Messenger — `048fa1e7` (10/10 01:13)

Un negocio que usa **sólo Instagram por Zernio** (el ws13 en producción) no tiene
`envio_whatsapp_enabled` ni `envio_email_enabled`. El primer DM salía por la vía rápida del
evento, pero **lo que viene después de una espera larga lo despierta el cron**, y sus dos
puertas devolvían modo `off`: el DM 2 no salía nunca, sin un error, y se perdía la ventana de
24 h de Meta. Las dos puertas preguntan ahora con **una** función pura, `correSinCanales`
(`lib/motor-tick.ts`). **Latente**: hoy no hay secuencias sociales en producción.

### 1.10 Los textos y los ejemplos que mentían — `a3bb5dee` y `cd8b805c` (10/10, revisión del ws9)

- **El lienzo de un REPORTE dibujaba los canales de su plantilla** (WhatsApp por default) y no
  los de las preferencias de notificaciones, que son por donde sale: el semanal mostraba
  WhatsApp y no Email. Ahora los contesta `canalesDeMensaje`.
- **El disparador del semanal decía «en la hora del negocio»** y el cron corre a las 14:20 UTC
  para todos, con la semana cortada en hora de Tijuana. Ahora dice «hora de Tijuana».
- **Los ejemplos del catálogo nombraban clientes REALES de Mauricio** (Sergio Esquer, BG
  Trucking, Aspro) en el lienzo que abre cualquier negocio. Son ficticios ahora, y el guard de
  `tests/variables-aviso.test.ts` suma esos nombres a su lista.
- **El «En 30 min tienes la R1» al dueño miraba sólo la hora**: una cancelación de Calendly
  borra la fecha y deja la hora, así que avisaría de una reunión **cancelada** (0 de 130 filas
  el 10/10). La elección pasa a una función pura, `reunionParaElDueno`.
- **«Mensaje de WhatsApp entrante»** decía «Un lead contesta por el WhatsApp del negocio…» y
  sólo lo emiten las respuestas a una automatización: ahora dice lo que es.
- **Los dos recordatorios de la cadencia de una cuota vencida** salían sin emoji, sin firma y
  con «márcalo en su ficha» **sin el link**. El `leadId` viaja en la corrida, así que
  `{{link_lead}}` se resuelve.

**Tests del área, corridos el 10/10 a las 22:10 UTC: 188 de 188 en verde** (`linea-vigilancia`,
`lineas-whatsapp`, `reporte-semanal-clientes`, `cron-aviso`, `cron-aviso-dias`, `sin-chatwoot`,
`whatsapp-sin-chatwoot-gate`, `email-y-canales`, `cruce-notificaciones`, `borrador-camino`,
`notificaciones`, `variables-aviso`, `whatsapp-sexta-tanda`).

---

## 2. Lo que NACIÓ en la ventana (el 05/10 no existía)

- **`wa-reconectado`**, el aviso de «volvió tu WhatsApp» (`lib/avisos-catalogo.ts`, `9da594a2`).
  Es el primer aviso del catálogo que existe para **desmentir** otro aviso.
- **`REPORTE_POR_WHATSAPP`** y el módulo que decide de dónde sale «por dónde llega» cada
  mensaje: `lib/mensaje-canales.ts` (`canalesDeMensaje`, `guardarCanalDeMensaje`).
- **`mako.plantillas.base`**, la clave del store de mensajes de la plataforma, separada del
  store del ws9 (`7ad16c8a`).
- **`lib/borrador-camino.ts`**, que reemplaza a `lib/borrador-oficial.ts`: un solo camino para
  los borradores, el número de empresa. Se fue con él `lib/ventana-24h.ts` (la pared de 24 h de
  Meta ya no tiene ningún lector).
- **`app/whatsapp/_shared/ComposerWhatsApp.tsx`** y **`BurbujaHilo.tsx`**: el composer y la
  burbuja únicos de todo el producto.
- **`app/whatsapp/_shared/BotonAgregarAlCrm.tsx`**: el alta de un lead desde el chat, con
  elección de producto.
- **`lib/motor-tick.ts`** (`correSinCanales`), y **`lib/zernio*.ts`** / `lib/canal-social.ts`:
  Instagram y Messenger como **canales** de una automatización.
- **La etiqueta de git `archivo/chatwoot-2026-10-09`**, que es hoy el único lugar donde existe
  el WhatsApp oficial.
- **Migraciones de la ventana que tocan esta área:** `0198_varias_lineas_whatsapp.sql` +
  `0199_lineas_sin_unique_ws.sql` (varias líneas por negocio, partidas a propósito: la 0198
  agrega ANTES del deploy y la 0199 saca DESPUÉS), `0225_setting_adjuntos.sql` (los adjuntos de
  un mensaje van por referencia a una biblioteca, nunca embebidos en el paso) y
  `0242_canales_zernio.sql`.

---

## 3. Lo que quedó a medio hacer o sin verificar, y dónde vive

**Lo más urgente está arriba.**

### 3.1 ⚠️ La tabla `notificaciones` NO EXISTE en producción, y ahora importa más que antes

Verificado el 10/10 a las 22:05: PostgREST contesta
`PGRST205 — Could not find the table 'public.notificaciones' in the schema cache`. Es la
misma medición que el briefing del 06/10, y **sigue igual**.

Lo que cambió es el precio. `crearNotificacion` (`lib/notificaciones.ts:76`) es best-effort, así
que no tira: **falla en silencio**. Y los dos despachadores dicen que el feed es la bitácora:
`lib/notify.ts` escribe el reporte al feed («bitácora durable») y `lib/avisos.ts` escribe la fila
del feed **antes** de decidir el canal, justamente para que un aviso espaciado o sin canal quede
registrado. **Las dos cosas son no-ops.** Consecuencias concretas:

- Un aviso que no sale por WhatsApp **no queda en ningún lado**.
- El reporte semanal del **ws15**, que el lunes se saltea por no tener email, no va a dejar
  rastro de que existió.
- No hay forma de comprobar que el «se cortó / volvió» del ws11 (sección 1.5) **llegó**: la
  marca de dedup se escribe antes del envío.

Vive en `lib/notificaciones.ts` y le falta su migración.

### 3.2 ⚠️ Nadie escaneó un SEGUNDO QR todavía — y ahora hay cinco líneas, no tres

Medido el 10/10 a las 22:04 (`evolution_instancias`): **cinco filas, una por workspace**, las
cinco con `es_default = true` y `etiqueta` en `null`.

| ws | instancia | estado | número | última conexión |
|---|---|---|---|---|
| 1 | `mako_ws1` | conectado | 5216862168122 | 10/10 19:10 UTC |
| 9 | `mako_ws9` | conectando | null | nunca |
| 10 | `mako_ws10` | conectando | null | nunca |
| 11 | `mako_ws11` | conectado | 5212211229846 | 10/10 19:58 UTC |
| 13 | `mako_ws13` | desconectado | null | nunca |

O sea que **el desplegable de líneas, el «Sale por» y todo el camino de dos líneas siguen sin
ejercitarse contra un segundo QR real**. Está verificado con tests, contra producción (las dos
migraciones aplicadas) y en el navegador con las escrituras abortadas; la primera vez que
alguien escanee un segundo número es la prueba que falta. Vive en
`app/whatsapp/EvolutionConnect.tsx` y `lib/evolution.ts`.

Y el espejo de mensajes confirma lo mismo: de **1.000 filas de `wa_mensajes`** leídas (el techo
de PostgREST, así que es una **muestra**, no el total), **las 1.000 son `ws1 / mako_ws1`**.

### 3.3 El aviso de línea CAÍDA sigue sin poder nombrar el número; el de «volvió» sí puede

`lineaLegible` (`lib/linea-vigilancia.ts:102`) usa la `etiqueta` y, si no hay, el `numero` **de
la fila**. Y el `numero` se borra al desconectar, en los dos caminos:
`app/api/webhooks/evolution/route.ts:148` (`if (estado === 'desconectado') patch.numero = null`)
y `lib/evolution.ts:675` (`desconectar()`). Las cinco filas de producción tienen `etiqueta` en
`null`, y las tres desconectadas tienen `numero` en `null`.

Queda una asimetría: cuando la línea **vuelve**, el webhook le repone el `numero`, así que el
«volvió» **sí** lo nombra (es lo que promete el texto, `+52…`); el «se cortó» no. **Sin
verificar** contra el mensaje real que le salió a Leila el 09/10 — el mecanismo lo explica, el
texto enviado no quedó en ninguna parte (ver 3.1). Lo que lo arregla de fondo es **guardar el
último número conocido** en vez de borrarlo.

### 3.4 El reporte semanal guardado del ws1 tiene la foto de julio **y texto de prueba adentro**

Medido el 10/10 a las 22:10, en `mako.plantillas.store` del ws1, entrada `reporte-semanal`:

- `texto` (lo publicado): `🗓️ *Reporte semanal* — 07/07 al 13/07 … *Cash de la semana:* $12.800 **ZZZ**`
- `borrador` (sin publicar): lo mismo con `$12.800 **ZZZ QQQ**`
- `flujo.disparador.tipo: 'manual'`, `flujo.pasos: []`, y un `posiciones` (alguien movió la
  tarjeta en el lienzo).

Hoy **no sale**: `avisos_programados` tiene **cero filas** (verificado), y el cron del semanal
no usa ese texto — arma el reporte con `buildReporteSemanal`. Pero si alguien elige **«Por
tiempo»** sobre ese mensaje, se agenda y empieza a salir la foto de julio con `ZZZ` adentro. La
guarda de `16c0d66c` caza el **ejemplo de fábrica**; no caza un texto propio con números viejos.
Vive en `lib/cron-aviso.ts` (`motivoNoAgendable`) y en el store del ws1.

### 3.5 Lo que sigue mirando sólo la línea por DEFAULT

Todo verificado por grep el 10/10:

- **El cartel rojo de `/automations`**: `estadoCanalWhatsapp`
  (`lib/api-mako/areas/chatbot.helpers.ts:116`). La tarjeta de cada secuencia ya avisa si **su**
  número está caído; el cartel general, no.
- **El seguimiento post-llamada**: `lib/post-llamada.ts:209` llama a `crearBorrador({ leadId,
  telefono, texto, origen: 'post_llamada' })` **sin línea**. Las dos únicas filas de
  `wa_borradores` en producción (ids 6 y 7, del 11/09 y el 15/09) tienen `instance_name` en
  `null` y están `descartado`.
- **Las etiquetas, la foto de perfil y el LID**: lectores sin línea pedida en `lib/evolution.ts`.
- **Desvincular la de por default con otras vivas** deja a las secuencias sin línea apuntando a
  una caída: hay que tocar «Usar por default» en otra. No se promueve sola, a propósito.
- **Un mensaje entre dos líneas del MISMO negocio** choca con el único
  `unique (workspace_id, wa_message_id)` de `wa_mensajes` (`supabase/migrations/0073_wa_mensajes.sql:31`):
  el lado que llega segundo no se guarda.

### 3.6 Un aviso APAGADO se loguea como «ya avisado hace poco»

`lib/avisos.ts:377`: `if (!(pl?.enabled ?? true)) return { ok: true, feedId: null, wa: false,
deduped: true }` — devuelve `deduped: true` y no `apagado`. **Sigue igual.** Sólo afecta al log,
y lo hace mentir: con el feed inexistente (3.1), el log es lo único que hay.

### 3.7 Un click para mirar sigue agendando

`app/agencia/FlujoAviso.tsx:1166`: elegir «Por tiempo» escribe `CRON_DEFAULT` en el acto y
recién revierte si el server se niega. Es la causa de que el grupo de Leila recibiera cuatro
días seguidos a las 9:00 un recordatorio con un lead real de otro cliente. Es producto, no un
arreglo (decisión 5.1 de la sección 6).

### 3.8 Lo que quedó sin emisor y sin dueño

- **`lead.wa_entrante`** (`lib/flujos-tipos.ts`) quedó **sin emisor** al borrar Chatwoot: lo
  dice ahí y queda pendiente.
- **`crm_etiquetas.chatwoot_label`** sigue siendo una columna de la base que ya no lee nadie.
- **crm-auto T3** (nutrición manual vencida) contaba mensajes en Chatwoot para mover a «No
  responde»; ahora pide decidir, sin afirmar «sin mensajes» — el lead puede haber escrito por
  el número de empresa, que T3 **todavía no lee**.
- **Los pasos `accion` de un flujo** mueren como «operación desconocida» y el lienzo dibuja un
  `wa_lead` como «Le escribe al lead» aunque ya no escriba nada (`lib/flujos.ts`,
  `lib/flujo-pasos.ts`).

### 3.9 Lo que no es mío y conviene nombrar

Hay **varias sesiones trabajando sobre este mismo clon** mientras se escribe esto. Medido con
`git status` a las 22:25 UTC del 10/10, sin commitear y **ajeno a esta área**:
`lib/campana-atribucion.ts`, `app/crm/CrmBoard.tsx`, `app/crm/CrmToolbar.tsx`,
`app/crm/arbol-seleccion.ts` (nuevo), `tests/crm-filtro-ads.test.ts` y los otros briefings de
`docs/relevo/` (que se están reescribiendo en paralelo, uno por área). **Nada de eso se tocó.**
Si algo del CRM o de la atribución de campañas parece roto, mirar primero si es trabajo a medio
hacer de otra sesión: `git status --short` antes de diagnosticar.

---

## 4. Las trampas del área (lo que ahorra tiempo la próxima vez)

### 4.1 ⚠️ Apagar un servicio cambia lo que contesta todo el que pregunta «¿está conectado?»

Es la trampa más cara de la ventana. Con Chatwoot apagado, **«no conectado» pasó a ser la
respuesta de TODOS**, y una puerta vieja de `/whatsapp` se la mostró a cualquier cliente con el
número desvinculado. Martín, 09/10, con una captura de `/whatsapp?ws=11`: *«En la otra cuenta
había pedido que eliminases la integración con chatwoot y sigue apareciendo, solucionalo rápido
que los clientes lo necesitan usar y eso lo bloquea»*.

**La tab ENTERA era el formulario «Conecta tu cuenta por Chatwoot…»**, y el apagado del mismo
día (`2375d53a`) no tocó ninguna de las dos causas:
1. `app/whatsapp/page.tsx` caía al `PanelActivacion` cuando no había canal vivo — y
   `listarLineas` fallando también cae a `false`;
2. `lib/tab-activacion.ts` declaraba el servicio `'whatsapp'`, que **son las credenciales de
   Chatwoot**, así que ese panel era su formulario.

**La regla: antes de apagar algo, se buscan las PUERTAS que cuelgan de esa respuesta, no sólo
las llamadas.** Lo fija `tests/whatsapp-sin-chatwoot-gate.test.ts`.

### 4.2 El diagnóstico obvio del semanal era el equivocado (y sigue siendo el que aparece primero)

Parecía que el arreglo iba en el choke point `despacharReporte` —un solo lugar, los tres crons
pasan por ahí—. No: el diario y el horario **no** tienen `porDefecto: 'on'` y se habrían callado
en el ws1. El arreglo vive en el cron semanal.

### 4.3 «No existe la instancia» y «la sesión se cayó» llegan igual de muertas y no son lo mismo

Ni el estado de la fila ni `ultima_conexion_at` las distinguen: el webhook escribe lo mismo en
los dos casos. **Lo único que las separa es qué contestó la sonda**: una caída de verdad deja la
instancia **viva** en Evolution; una desvinculada no tiene instancia (Evolution contesta 404
«the … instance does not exist»). `esInstanciaInexistente` (`lib/evolution-sonda.ts:79`) lo
reconoce en un solo lugar, y `decidirLinea` recibe `sinInstancia` **obligatorio** para que un
vigilante que se olvide de pasarlo no compile. Sin eso, el negocio que **suelta su número a
propósito** recibe «🔴 Se cortó tu WhatsApp… reconéctalo» cada 24 h para siempre.

### 4.4 Una marca de dedup NO es un acuse de recibo

`reclamarEspaciado` escribe `mako.aviso.last.<tipo>:<hash>` **antes** del envío, y a propósito:
el reclamo es atómico porque Evolution retiene el HTTP abierto 7 a 11 segundos simulando el
tipeo anti-ban, y en ese hueco dos invocaciones del mismo tick mandaban dos veces (medido el
27/09: 21 pares duplicados). La contracara es que **la marca existe aunque el mensaje no haya
llegado**. Si lo que se quiere saber es si llegó, la marca no lo contesta.

### 4.5 Para leer una clave de dedup, se calcula el hash

La clave es `mako.aviso.last.<tipo>:<sha1 base64url de 12 caracteres>`
(`lib/espaciado.ts:42`). Mirando sólo la clave no se sabe de qué entidad es. Una línea:

```bash
node -e "const{createHash}=require('crypto');console.log(createHash('sha1').update('mako_ws11').digest('base64url').slice(0,12))"
```

### 4.6 El store de mensajes se HEREDA campo por campo, y eso ya mordió tres veces

`leerStore` / `leerPar` (`lib/plantillas.ts`) funden la base de la plataforma con el store del
negocio. Es correcto para todo lo terminado y **falso para todo lo que no lo está**: un
**borrador** heredado le pone a cada cliente un «Sin publicar» que no escribió, y al publicar
publica en SU negocio el borrador de la plataforma. Por eso el borrador es el único campo con
excepción explícita en el merge. Lo mismo vale para un **paso de acción**: heredado, corría en
el tablero y el CRM de cada cliente.

Y el linaje de la base: `OWNER_WS` (el ws1, un cliente) → `wsSuperAdmin()` (el ws9, también un
negocio real) → `mako.plantillas.base` (una clave propia). **Las dos primeras versiones eran
correctas al escribirse y las dos filtraban datos de un negocio real a los demás.**

### 4.7 Dos tiendas para «por dónde llega un mensaje», y no es un descuido

- Los **tres reportes** tienen su canal en `notification_prefs` (`CanalPrefs.wa` / `.email`).
- Los **avisos** lo tienen en su propia entrada del store (`canales`).

Moverlos a una sola tienda sería el cambio correcto y no se hizo porque los crons diario y
horario no iteran inquilinos. **Lo que NO se puede es que cada pantalla decida de dónde leer**:
ahí nacen los dos interruptores que dicen cosas distintas sobre el mismo mensaje. La decisión
vive en `canalesDeMensaje` (`lib/mensaje-canales.ts`) y en ningún otro lado.

### 4.8 «Apagado» son DOS interruptores

Un reporte sale sólo si están los dos prendidos: `notification_prefs.semanal.activo` (lo que el
cron leía desde julio) **y** el `enabled` de la plantilla en `/mensajes`, que es el que ve el
cliente (`decidirReporte`, `lib/reporte-destino.ts`). Leyendo sólo el primero, un cliente que
apaga el semanal en su lista lo seguiría recibiendo.

### 4.9 En producción hay DOS migraciones numeradas 0223

Verificado el 10/10: `0223_curso_papelera.sql` (commit `d188f3a8`) y `0223_flujo_grafo.sql`
(commit `c3d85077`), las dos en git. Es exactamente la colisión que `AGENTS.md` advierte: el
próximo número de migración es un recurso compartido entre sesiones. Hay además huecos
(0234–0239 y 0243–0244) y la última es `0245_email_entrantes.sql`. **Antes de nombrar una
migración: `git pull` y `ls supabase/migrations/ | tail -5`.**

### 4.10 Evolution le BORRA un dígito a los números de Argentina y México

Su `createJid` agarra todo número de 13 dígitos que empiece con 52 o 54 y le saca el **tercero**:
`5491125052605` sale como `541125052605`. WhatsApp conoce esos números con el dígito puesto, así
que el pedido va a OTRO número — y no da error: da un `403` (`addressable: false`) adentro de un
`201`. **Un número que dio WhatsApp viaja como jid completo** (`jidCanonico`,
`lib/participantes-grupo.ts`); lo que tipeó una persona va crudo.

---

## 5. Qué espera una decisión de Martín

### 5.1 ¿Elegir «Por tiempo» tiene que guardar en el acto?
Hoy **sí**, y por eso un click para mirar qué hace el botón deja un envío diario vivo — que es
exactamente lo que le pasó al grupo de Leila (cuatro días a las 9:00 con un lead de otro
cliente). Vive en `app/agencia/FlujoAviso.tsx:1166`.
- **A:** que abra el editor del horario y **no guarde hasta confirmar**. Choca con «elegir uno
  apaga el otro y es una escritura», que se pidió así.
- **B:** queda como está, con la guarda del ejemplo de fábrica como única red.

### 5.2 Para «Por tiempo» sobre un reporte: ¿mandar la foto o correr el generador?
Hoy manda el texto guardado, que envejece: el del ws1 **sigue siendo el de julio y tiene `ZZZ`
adentro** (medido, 3.4).
- **A:** que «Por tiempo» corra el generador a esa hora (es una feature, no un arreglo).
- **B:** que no se pueda agendar un reporte por tiempo.
- **C:** queda como está.

### 5.3 ¿Los reportes diario y horario se abren a los clientes?
Hoy quedaron a propósito como del dueño, con un test que lo fija. Abrirlos es empezar a mandar
un email por día a cada negocio (ya no un WhatsApp: 1.2).

### 5.4 ¿Qué se hace con ws15, que el lunes no recibe nada?
Brigitte (ws15) tiene **dos teléfonos y ningún email**, así que al apagar WhatsApp en los
reportes se quedó sin canal (medido, 1.3). ws3, ws4 y ws17 tampoco reciben, pero son workspaces
de prueba.
- **A:** pedirle un email (nadie se lo pidió todavía; hoy se saltea en silencio).
- **B:** que el reporte de quien no tenga email salga por el grupo de MaKo — que es la opción
  que la decisión del 10/10 descartó («no mandarlo al grupo de MaKo»).
- **C:** queda salteado, y al menos que quede registrado (necesita la tabla `notificaciones`).

### 5.5 ¿Cuándo se borra `lib/chatwoot.ts`?
Es un cascarón de 158 líneas que vive sólo porque lo importan archivos que la rama
`wip/api-acciones-0910` tiene a medio cambiar. **Decide si esa rama entra o se descarta**; en
cuanto se resuelva, el archivo se borra entero y el guard ya está escrito.

### 5.6 La tabla `notificaciones` no existe: ¿se crea?
Es una migración y resuelve 3.1 entero: hoy un aviso que no sale por WhatsApp no queda en
ningún lado, y no hay forma de auditar si un aviso llegó. Mientras no esté, cualquier pregunta
del tipo «¿le llegó el reporte a X?» se contesta con «la marca de dedup dice que se intentó».

---

## 6. Lo que el briefing del 06/10 decía y **ya NO es cierto**

| Decía (06/10) | Hoy | Qué lo cambió |
|---|---|---|
| «El renglón de WhatsApp sale por el Chatwoot del workspace» | **Chatwoot no existe**, y el reporte **no sale por WhatsApp en absoluto** | `dae6b3b4` (09/10) y `90c5e313` (10/10) |
| «ws15: dos teléfonos y ningún mail» → le llega por WhatsApp | ws15 queda **salteado**, no recibe nada | `90c5e313` |
| «ws1, ws10, ws13, ws14: un teléfono y un mail» · «ws11: dos teléfonos y un mail» | les llega **sólo el mail** | `90c5e313` |
| «Una contradicción sin resolver: ¿el ws4 tiene Chatwoot o sólo el ws1?» | **La pregunta ya no existe**: Chatwoot se borró y las credenciales no se leen | `f98778f7` (09/10) |
| «El vigilante no mandó ningún aviso todavía. No existe ninguna clave `mako.aviso.last.wa-desconectado`» | **Mandó dos al ws11 el 09/10**: la caída a las 15:00:32 UTC y el «volvió» a las 18:40:31 UTC | el despliegue de `c7510ddd` + `9da594a2` |
| «Tres filas en `evolution_instancias`, una por workspace (1, 11, 13)» | **Cinco filas** (1, 9, 10, 11, 13); sigue **ninguna** con segunda línea | se conectaron ws9 y ws10 |
| «Las tres filas de producción tienen `numero` en null» | las **conectadas** tienen número; las desconectadas, no — así que el «volvió» **sí** nombra el número y el «se cortó» no | el webhook lo repone al reconectar |
| Decisión pendiente: «¿`wa-desconectado` entra en la lista que el cliente puede apagar?» | **CONTESTADA: sí.** Entra, y el cliente lo puede apagar | `9da594a2` («las dos cosas») |
| Decisión pendiente: «¿Hay un aviso de volvió?» | **CONTESTADA: sí.** `wa-reconectado`, sólo si la caída se avisó | `9da594a2` |
| Decisión pendiente: «¿El semanal a los clientes va también por el grupo de MaKo?» | **CONTESTADA: no.** «Apagar WhatsApp en los reportes»; email y nada más | `90c5e313` |
| «La base de la herencia del store pasó a `wsSuperAdmin()`» | correcto el 06/10, **insuficiente**: ese era el store del ws9, un negocio real. Ahora es `mako.plantillas.base` | `7ad16c8a` (10/10) |
| «`nutricion_envios`: 15 filas, las 3 nuevas salieron» · «3 inscripciones activas en el ws1» | **21 filas, 9 enviadas** (ids 13-21, la última el 10/10 a las 14:00:51 UTC); las 12 de `fallo` siguen siendo las viejas (hasta el 24/09). Queda **UNA** inscripción activa (id 202, próximo envío 11/10 14:00 UTC) | el motor siguió corriendo |
| «La tab `/chatbot`» | se llama **`/automations`** desde el 09/10; `/chatbot` redirige con la query entera. **Las claves guardadas no cambiaron** (la key `setting`, el área `chatbot` de la API, `/api/chat-agent/*`) | `04f40af4` |

**Lo que el briefing del 06/10 decía y SIGUE siendo cierto** (re-verificado el 10/10): la tabla
`notificaciones` no existe · `avisos_programados` tiene cero filas · el store del ws1 conserva
el `reporte-semanal` de julio · un aviso apagado se loguea como `deduped` (`lib/avisos.ts:377`) ·
«Por tiempo» guarda en el acto · el cartel de `/automations`, el post-llamada y los lectores sin
línea van por la de por default · el unique de `wa_mensajes` pierde el segundo lado de un
mensaje entre dos líneas del mismo negocio · los reportes diario y horario son sólo del dueño.
