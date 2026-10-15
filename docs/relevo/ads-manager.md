# Relevo — Ads Manager, Meta e Instagram

**Reescrito el 10/10/2026 para una cuenta de Claude que arranca SIN historial.** Ventana que
cubre: **05/10/2026 12:33 (`6785dc16`) → 10/10/2026 18:59 (`9862c146`)**. La versión anterior de
este archivo se escribió el 06/10 y su último commit fue `db7b7682` (07/10 15:47): **todo lo del
07/10 16:06 en adelante no estaba acá**, y abajo hay dos afirmaciones suyas que resultaron falsas.

**Qué es esta parte del producto, para quien nunca la vio.** MaKo es el dashboard de marketing que
Martín Koncke vende como SaaS. Esta área es la pantalla **`/ads-manager`**: el panel desde donde un
cliente ve y opera sus anuncios de **Meta** (Facebook/Instagram Ads) sin entrar al Ads Manager de
Meta — crear una campaña, subir creativos, pausar, cambiar presupuesto, renombrar, borrar, editar
los textos de un anuncio y a quién se le muestra. Del otro lado está la **conexión con Meta** (el
token de cada cliente, la cuenta publicitaria, la página, la entrada de leads de los formularios) y
la tab **`/instagram`**, que se retiró el 06/10 y hoy sólo redirige.

> **Vocabulario mínimo:** *ws1* = el workspace 1, que es de **Mauricio Bustos, un CLIENTE** (la
> constante se llama `OWNER_WS` por historia, no porque sea el dueño). *ws9* = el workspace de
> Martín. *ws3* = Cliente de Prueba. *ws11/13/14/15* = clientes reales. Un *conjunto* es un ad set.

---

## Retomado el 13/10/2026 (cuenta 2): lo que se fue cerrando

Pedido de Martín, por el chat «Estrategia 3 CUENTAS»: continuar y cerrar lo planificado acá, sumar la
#801 (el Ads Manager no tiene onboarding) y no tocar lo nuevo de `mako-feedback-y-tareas.md`. Todo
quedó **en el main del clon, sin push**: el push lo hace «Estrategia 3 CUENTAS», uno solo, con todo
junto. ⚠️ **Ninguno de estos commits pasó por el typecheck**: el 13/10 el tsc moría sin memoria y
después se pidió no correr más tsc completos. Si el pre-push de ese push da rojo en un archivo de
abajo, es de acá.

| Commit | Qué se cerró |
|---|---|
| `47fdde66` | Las monedas sin centavos (COP, CLP, JPY…): leer, escribir y crear presupuestos con la unidad de cada moneda (`offsetMeta`, `lib/presupuesto-cambio.ts`); escribir sin saber la moneda se niega (503). Y `EntityDetalle.tsx` ya no escribe «MXN» a mano |
| `e4fb140b` | Un conjunto, anuncio o campaña de OTRA cuenta de Meta no se lee ni se escribe (404): público, textos, datos de campaña y `metaWrite` (pausar/presupuesto/renombrar/borrar). Regla: `esDeLaCuenta` (`lib/meta-cuenta-id.ts`) |
| `81e80fb2` | La bitácora y `docs/hallazgos-ads.md` ya no mandan a «aplicar la 0215»: medido de nuevo el 13/10, está aplicada (0 de 19 borradores con clave) |
| `c2ffe6a8` | Los lotes (pausar, activar, presupuesto) salen a Meta de a 4, no todos juntos |
| `327d35ba` | La tarjeta de Meta en `/integraciones` dice «Faltan permisos de anuncios» en vez de «No se pudo leer» |
| `41aa319f` | Una sola moneda por defecto (eran 'MXN' y 'USD'), y crear sin la moneda leída se niega |
| `19b7542e` | **#801: el onboarding de la tab.** Tres pasos (cuenta leída, página, primera campaña) que la page DERIVA al abrir: quien ya opera su cuenta no lo ve. Con «Lo configuro después». ⚠️ **Sin mirar en el navegador todavía** (RAM: ~3,4 GB libres con muchas sesiones; un `next dev` arriesgaba a los otros chats). Se mira en ws3: entrar a `/ads-manager?ws=3` como super admin |

| `435410f3` `f5222270` | **Punto 18, el Autopilot: el DISEÑO** (`docs/diseno-ads-autopilot.md`, el contrato) y lo que midió el relevamiento (`docs/hallazgos-ads.md` → «El Autopilot») |

### El Autopilot (punto 18): diseñado, la implementación quedó A MEDIAS y FUERA del main

Validado por Martín el 13/10 («implementalo completo y de punta a punta»). El 14/10 a las 02:20 el
cierre pedido por Martín («que se pushee todo y que los chats cierren») cortó la corrida que lo
implementaba. **Lo que hay:**

- **El diseño**, en `docs/diseno-ads-autopilot.md`: el veredicto es CÓDIGO con los umbrales del
  cliente (reglas R1–R5), apagado por default, modo «propone» o «automático» dentro de sus topes, la
  decisión se relee en vivo y pasa por `validate_only` (para frenar, no como prueba), deshacer al
  valor exacto, tabla propia `ads_autopilot_decisiones`.
- **La base a medias, en la ref `refs/wip/autopilot-base-1410` (`2d5675b3`), NO en el main**:
  `lib/ads-autopilot-config.ts`, `lib/ads-autopilot-reglas.ts`, `lib/ads-autopilot-db.ts`,
  `lib/ads-autopilot-datos.ts`, `supabase/migrations/0275_ads_autopilot.sql` (sin aplicar), los
  cambios a `lib/meta-write.ts` (`validarSolo`), `lib/meta-health.ts` (`getMetaHealthVivo`),
  `lib/workspace.ts` y `lib/tablas-de-inquilino.ts`, y cuatro tests. Los agentes se cortaron antes
  de terminar: **sin revisar, sin typecheck y con los tests sin confirmar**. Se retoma con
  `git checkout refs/wip/autopilot-base-1410 -- <rutas>` sobre el main de ese día, se revisa cada
  archivo contra el contrato y se corren sus tests.
- ⚠️ **La 0275 YA NO SIRVE como número, y se RENUMERA al retomar** (aviso del chat de Estrategia, 15/10/2026).
  La ref no es una rama, así que desde main ese número se ve libre, y mientras tanto se tomaron de la
  0276 a la 0284 (medido el 15/10 en los 25 checkouts: unas en main, otras en ramas). Al traer
  los archivos de la ref, la migración **no** se trae con su nombre viejo: va al primer número libre
  **mirando todos los worktrees** (`git worktree list`) y no sólo main, y se aplica con ese nombre. El
  orden no la rompe: sólo depende de `workspaces`. Y no hay una `0275_` huérfana en ningún disco: el
  archivo existe sólo adentro de la ref.
- **Falta entero:** el motor y el cron (`lib/ads-autopilot.ts`, `app/api/cron/ads-autopilot/route.ts`,
  `vercel.json`), la pantalla (`app/ads-manager/AutopilotBoton.tsx`, `autopilot-actions.ts`, montaje
  en `CampanasBrowser.tsx`), la API de MaKo (`ver_autopilot_anuncios`, `aplicar_decision_autopilot`
  con pantalla + dinero + admin y negada a los flujos, `descartar_decision_autopilot`), aplicar la
  0275, mirarlo en ws3 (**ojo: el ws3 llegó a compartir la cuenta del ws1**, contar antes) y la
  revisión adversarial de plata e inquilinos. El guion del script de la corrida está en
  `~/.claude/projects/…/workflows/scripts/ads-autopilot-implementar-wf_f6f3a30f-65e.js`.
- **Las variaciones de hook filmadas solas son de «Content Machine»**, con cuatro bloqueos en orden
  (en el diseño, «Lo que queda afuera»).
- **Bug vivo encontrado de rebote, sin arreglar:** `ver_rendimiento_anuncios` de la API de MaKo
  devuelve `leads_meta` = la constante 10 y `leads_crm` = los leads de Meta
  (`lib/api-mako/areas/ads.run.ts:381`).

---

## Lo primero que hay que mirar

1. **La bitácora del área miente sobre la migración 0215** y manda a hacer algo que ya está hecho
   (punto «Corregido», abajo). Si entrás a trabajar acá, eso es lo que te va a desviar primero.
2. `git log --oneline -15 -- app/ads-manager/` y después **grepeá la ruta que vas a tocar** en
   `docs/hallazgos-ads.md` (3.900+ líneas: nunca se abre entero, se busca por `**Vive en:**`).
3. `app/admin/dev/ads-manager/bitacora.ts` (se ve en `/admin/dev/ads-manager`): los pedidos
   textuales de Martín. Sus tres últimos hitos están en `estado: 'sigue'`.

---

## En qué quedó: hecho, pusheado y desplegado

`HEAD == origin/main == 9862c146`. Medido el 10/10/2026 con `vercel ls`: todos los deploys de
producción en **Ready**, el más reciente 5 minutos antes de la medición. El árbol de trabajo estaba
**limpio** (ninguna otra sesión tenía nada sin commitear en estas rutas).

| Commit | Fecha | Qué quedó andando |
|---|---|---|
| `07073522` | 05/10 23:54 | Elegir el **producto** al crear una campaña, y asignarlo desde la tabla |
| `0b48181e` `f36651e3` `60fc93b0` `d46b0eca` | 06/10 | Rediseño de la pantalla: «Nueva campaña» arriba a la derecha, el resto en un `⋯`, UN filtro, selección múltiple, tabla densa, barra de lote |
| `8d16c6ff` | 06/10 14:23 | **Instagram sale del producto**: la tab, su API y su integración (#792) |
| `db7b7682` | 07/10 15:47 | **Pausar, presupuestar, renombrar y borrar con la cuenta de CADA cliente** (antes era 403 fuera del ws1) |
| `9f745fae` | 07/10 16:06 | Botón **«Conectar con Meta»** con la app propia de MaKo + sección `#meta` en la privacidad |
| `025f44ec` `6f5c43fc` | 07/10 17:49-18:21 | El presupuesto pasa por un **cartel de confirmación** y en la **moneda de la cuenta** (#349) |
| `f6ed4c33` `c5a5c933` | 07/10 19:03-19:47 | Un video se usa **cuando Meta lo procesó**, y un reintento **no publica dos veces** (#59) |
| `772ae3ec` `5488bbe0` | 07/10 20:26-21:01 | **«Mis creativos»**: usar un video que MaKo ya generó, sin bajarlo y volverlo a subir (#797) |
| `335837cb` `6fe99555` | 07/10 21:37-22:05 | **«Dónde se muestra»** un conjunto que ya corre, y editar sus lugares (#715) |
| `af9030c7` | 08/10 01:12 | El **píxel de Meta de MaKo** en su propia landing (visita y agenda) |
| `6118b275` | 08/10 02:57 | **El gasto de Meta en dólares sale de la moneda de cada cuenta**, no asumiendo pesos |
| `e869a24e` `ddfb07e8` | 08/10 13:38 | El **poll de leads** corre cada 10 min y deja al webhook los recién llegados; MaKo lee lo que el lead contestó en el formulario |
| `d11aa86f` `87b32895` | 09/10 19:47-20:07 | **Instagram y Messenger VUELVEN como canales de las automatizaciones**, por Zernio (no vuelve la tab) |
| `71690b4b` `04f40af4` | 09/10 21:14-23:11 | El tacho de borrar de la casa (rojo) en `CrearFormulario.tsx`; `/instagram` redirige directo a `/automations` |

**Lo más importante de todo esto, en una línea:** hasta el 07/10 a las 15:47 **cada botón de
escritura del Ads Manager contestaba 403 para el admin de un cliente** y, para el super admin,
escribía con el token de Mauricio. Eso se cerró: `app/api/meta-write/route.ts:22` resuelve el
workspace con `wsDeAdsManager()` (`lib/ads-guard.ts`) y `lib/meta-write.ts:48` saca el token con
`credWs('META_ACCESS_TOKEN', ws)`.

---

## Lo que NACIÓ en la ventana (el 05/10 no existía)

| Archivo | Qué es |
|---|---|
| `lib/presupuesto-cambio.ts` (07/10) | La conversión USD → moneda de la cuenta, en UN lugar. Antes el ×17,30 del peso estaba copiado en tres |
| `lib/meta-idempotencia.ts` (07/10) | La clave de idempotencia de una publicación: `claveAMandar`, `trasRespuesta`, `decidirReintentoCampana` |
| `lib/creativo-mako.ts` + `lib/creativo-mako-fuentes.ts` (07/10) | Resolver una ref `montaje:<id>` / `toma:<plan>:<n>:<op>` a una URL del bucket propio, **en el server** |
| `app/ads-manager/MisCreativosMako.tsx` (07/10) | El selector de videos ya generados por MaKo |
| `app/ads-manager/LugaresLectura.tsx` (07/10) | «Dónde se muestra»: incluidos, excluidos, radio, el pin |
| `lib/meta-login.ts` + `lib/meta-conexion.ts` (07/10) | Facebook Login for Business con la app propia **MaKo (2586146911825340)**, y la ÚNICA puerta que guarda una conexión de Meta |
| `lib/moneda-meta.ts` (08/10) | `conversorGastoMeta()`: el gasto que se LEE sale de la moneda de la cuenta |
| `lib/meta-pixel-mako.ts` (08/10) | El píxel/conjunto de datos «MaKo» (1869323014511830) de la propia landing |
| `lib/titular-mako.ts` (08/10) | La razón social de MaKo, para que Meta la encuentre en el sitio |
| `lib/meta-leads-poll-reglas.ts` (08/10) | Las reglas del poll de leads cada 10 minutos |
| `supabase/migrations/0215_meta_campaign_drafts_idem.sql` (07/10) | `meta_campaign_drafts.idem_key` + su índice único parcial. **YA APLICADA** |

Y dos cosas que pasaron **fuera del repo** y mandan en el área:

- **La cuenta publicitaria de MaKo existe**: `act_1426493815659364`, en **USD** y zona horaria de
  Buenos Aires, en el portafolio MaKo (493711571134922), con la página «Hola MaKo»
  (1315098941694049). **Sin medio de pago todavía** — lo carga Martín. Decisiones suyas: nadie más
  como admin por ahora, y el doble factor al final.
- **El negocio quedó VERIFICADO el 08/10/2026 (~04:00), al tercer envío.** Meta no rechazaba el
  documento: rechazaba que la razón social no apareciera **en el HTML que el sitio sirve sin
  JavaScript**. El arreglo que lo destrabó fue sacar la portada de un bloque oculto del streaming
  de React, no publicar el nombre (eso ya estaba y había fallado).

---

## Lo que quedó A MEDIO HACER o SIN VERIFICAR

### Lo que bloquea de verdad

- **Los permisos de anuncios de la app MaKo NO entran.** Medido dos veces el 08/10 en ws9: el token
  vuelve bien (`/me` = «MaKo System User», no vence) y trae la página y los leads, pero
  `/me/permissions` **no lista `ads_management`, `ads_read` ni `business_management`**, aunque la
  configuración los pide. `/act_1426493815659364` contesta «(#200) Ad account owner has NOT grant
  ads_management or ads_read permission». Se descartó que sea el rol y que sea la cuenta elegida.
  **Hipótesis a la vista y NO MEDIDA:** la app está en «Marketing API Access Tier: Acceso limitado»
  y la verificación de acceso de proveedor de tecnología se **envió el 08/10 y sigue en revisión**.
  Se confirma o se descarta **reconectando cuando Meta conteste** y volviendo a mirar
  `/me/permissions`. Vive en `lib/meta-login.ts` · `lib/meta-conexion.ts`.
- **Por eso el botón «Conectar con Meta» todavía no lo ve ningún cliente.**
  `conectarMetaDisponible()` lo ofrece sólo al super admin hasta la aprobación, y a todos con
  `META_OAUTH_ABIERTO=true` en Vercel — **sin deploy**, el día que Meta apruebe.
- ✅ **CERRADO el 13/10 (`327d35ba`): la tarjeta de Meta dice «Faltan permisos de anuncios»**
  cuando Meta contesta con un error de permisos (códigos 10 y 200-299, `lib/meta-permisos.ts`).
  No se hizo leyendo `/me/permissions` al descubrir, como decía acá: el código de error de la
  MISMA lectura ya lo dice, sin pedidos de más y para cualquier conexión. Lo que NO hace: avisar
  al CONECTAR que el token vino sin esos permisos (eso sí pediría `/me/permissions` en
  `guardarConexionMeta`).
- **La app MaKo no tiene webhook de leads.** Nadie llama a `subscribed_apps`, así que los leads de
  un cliente conectado SÓLO por la app MaKo entran **por el polling, no en vivo**. Hace falta
  `pages_manage_metadata` (quedó afuera del App Review a propósito), suscribir la página, y que
  `app/api/webhooks/meta-leads` acepte la firma de **las dos apps** durante la migración.

### Bugs vivos, chicos y medidos

- ✅ **CERRADO el 13/10 (`47fdde66`): «MXN» escrito a mano en `EntityDetalle.tsx`.** Ahora el
  resumen que lee MaKo dice la moneda de la cuenta.
- ✅ **CERRADO el 13/10 (`47fdde66`): el offset de centavos.** La tabla de Meta (leída el 13/10)
  tiene 11 monedas con offset 1; la regla vive en `offsetMeta` (`lib/presupuesto-cambio.ts`) y la
  usan escribir, crear, el árbol, el saldo y la serie. Ningún cliente de hoy cobra en una de ésas.
- ✅ **CERRADO el 13/10 (`e4fb140b`): un id de OTRA cuenta**, en los cinco lugares que tenían el
  agujero (no sólo `adset-targeting`). Afuera a propósito: crear (Meta valida contra
  `act_<cuenta>`), el rollback, y las lecturas por ids de nuestros datos (`getObjectStoryId` de un
  ganador, `getAdsAprobacionPendiente`, `paginasDeGanadores`).
- ✅ **CERRADO el 13/10 (`41aa319f`): una sola moneda por defecto** (`MONEDA_META_POR_DEFECTO`,
  'USD', sólo para dibujar), y crear con presupuesto se niega si `cuentaMeta()` no LEYÓ la moneda
  (`monedaLeida`). Lo que sigue igual: el cartel de la tabla no distingue una moneda medida del
  default — en la práctica Meta siempre manda la moneda de una cuenta.
- ✅ **CERRADO el 13/10 (`c2ffe6a8`): el lote sale de a 4** (`allSettledConTope`,
  `lib/settled-con-tope.ts`), no todo junto. No baja el TOTAL de llamadas: un lote enorme puede
  agotar el cupo de Meta igual, y el error sigue saliendo por fila. No medido contra Meta.

### Lo que NUNCA se probó contra Meta de verdad

Esto es lo más importante de la sección: **casi todo lo del 07/10 se verificó con Meta SIMULADO.**
Lo tiene que hacer Martín, mirando, y cada punto dice por qué nadie más puede.

- **Publicar una campaña de verdad.** ws1 es un cliente con plata real. Con la app MaKo nueva Meta
  rechazaría todo creativo con el error 1885183 mientras la app esté en «modo desarrollo», y eso se
  destraba pasándola a «Publicada», **no con el App Review**. En qué modo está hoy **no está escrito
  en ningún lado**.
- **La idempotencia nunca corrió con una clave real.** Medido en producción el 10/10/2026:
  `meta_campaign_drafts` tiene **19 filas y 0 con `idem_key`**. O sea: la 0215 está aplicada, el
  código la usa, y todavía no pasó una publicación por ese camino.
- **Escribir un presupuesto en una cuenta real** (conviene una campaña EN PAUSA).
- **Cambiar los lugares de un conjunto real.** Sólo se probó en el navegador, 27 de 27 con Meta
  simulado. Hace falta una campaña de prueba en pausa **en una cuenta de Martín, nunca de un
  cliente**: cambiar lugares manda el conjunto a revisión y reinicia el aprendizaje.
- **Usar un video de MaKo de punta a punta.** Antes: conectar Meta en ws9 (hoy no tiene token, ni
  cuenta, ni página), tener ahí un anuncio generado (gasta créditos de Flow) y, para el montado,
  desplegar el contenedor del worker (`MONTAJE_WORKER_TOKEN`) — sin eso los dos montajes pendientes,
  que son de clientes, no se mueven.
- **Crear un formulario de leads desde cero** contra una página real: es irreversible (sólo se
  archiva). Martín elige la página.
- **Un video de 300-500 MB**: cuánto tarda Meta en procesarlo y si `file_url` lo acepta. El tope de
  15 minutos del navegador no está medido contra nada.
- **Joan / Código Inmobiliario (ws13):** el 16/09 su conexión era de una app propia en modo
  desarrollo, y por eso Meta rechazaba sus creativos nuevos (14 fracasos, todos 1885183 en el primer
  creativo). **No sé si reconectó.** Se mide con `debug_token` del token de ws13 comparando `app_id`.
  Lo mismo ws11 y ws14, que hoy conectan con apps de sus clientes.

### Deudas de prolijidad que ya mordieron

- **El tutorial de Meta** (`lib/metodo-catalogo.ts`) todavía enseña al cliente a crear una app
  propia, que es justo lo que el botón nuevo vino a evitar.
- **Bloquear tokens de apps ajenas** en `descubrirMeta` (mirando `app_id` del `debug_token`): hay
  que hacerlo **después** del App Review, porque antes dejaría a ws11/13/14 sin forma de conectarse.
- **La API de MaKo sigue sin «editar público»**: falta la función en la lib que lea el crudo y
  superponga en el server.
- **Fixtures con datos de clientes:** las lecturas que alimentaron el parser de lugares salieron
  **fuera del plan**, sobre tres cuentas de clientes (el ws1 incluido), y las fixtures commiteadas
  conservaban `primary_city_id` y `region_id` reales. En la revisión del mismo día pasaron a valores
  **sintéticos**. Queda la pregunta para Martín: si la medición se rehace sobre su cuenta cuando ws9
  tenga Meta, o si alcanza con la forma.

---

## Las trampas de esta área (esto es lo que ahorra horas)

1. **Si no hay workspace resuelto, el Ads Manager opera sobre el ws1 — que es un CLIENTE con plata
   real.** `wsQuePuedeOperar()` (`lib/ads-guard.ts:41`) devuelve el workspace de la pestaña y, si no
   resuelve ninguno y hay sesión de super admin, **cae a `OWNER_WS`**. O sea: Martín abriendo
   `/ads-manager` sin el `?ws=` de un cliente puede estar tocando la cuenta de Mauricio. Para probar
   algo, se entra **dentro** de un workspace.
2. **El error 1885183 de Meta juzga qué app PARIÓ el post, no quién llama.** Reusar un post o un
   `creative_id` que ya existe en la página propia **pasa** aunque la app esté en desarrollo; un
   `object_story_spec` nuevo da 1885183. Medido el 16/09 con corridas en seco.
3. **La conexión de Meta de un cliente son DOS tokens** (`META_ACCESS_TOKEN` y
   `META_PAGE_ACCESS_TOKEN`), y el de página **guardado le gana al derivado**. Cambiar sólo el de
   acceso deja la ingesta de leads con la app vieja, **y borrar la fila del token de página corta la
   entrada de leads**. Todo lo que guarde una conexión pasa por `guardarConexionMeta`
   (`lib/meta-conexion.ts`): es la única puerta, y ahí vive la regla.
4. **`META_APP_SECRET` es el secreto de la app VIEJA**, con el que se verifica la firma de cada lead
   del webhook. El de la app MaKo es **`MAKO_META_APP_SECRET`**. Pisar el primero con el valor del
   segundo no da error al guardar: **rechaza todos los leads entrantes**.
5. **El árbol de Meta que leen las guardas puede tener CUALQUIER edad.** `/api/meta-health` usa
   `unstable_cache`, que es stale-while-revalidate: la primera lectura después de vencer devuelve la
   entrada **vieja**. No se invalida al escribir, porque `TAG.marketing` es global y lo comparten 12
   lecturas de todos los workspaces. Lo que suelta un valor optimista es
   `presupuestosVigentes`/`horaDeEscritura` (`lib/presupuesto-cambio.ts`), comparando la hora del
   header `Date` de `/api/meta-write` contra el inicio de la lectura — **nunca un reloj local**.
6. **Un estimador de alcance que devuelve CERO no valida nada.** `delivery_estimate` contesta `0–0`
   **sin error** para lugares que se pisan o un radio fuera de rango; `reachestimate` devuelve el
   mismo subcode con el que la creación rechaza (8 de 8, medido el 11/09). Para validar antes de
   escribir se usa el endpoint que **falla igual que la escritura**.
7. **El campo «URI de redireccionamiento de OAuth válidos» del panel de Meta es de chips:** el texto
   pegado **no cuenta** hasta apretar Enter y después «Guardar cambios», y se pierde sin aviso. El
   08/10 eso costó una hora diagnosticando «el dominio no está en los dominios de la app», que era
   el diagnóstico equivocado. Se verifica con el **Validador de URI** de la misma pantalla, nunca
   releyendo lo tipeado.
8. **Cómo saber qué leyó Meta en una verificación:** 11-20 minutos después del envío llega desde la
   red de Meta (AS32934) un `GET /` con user agent de Chrome, referer `www.facebook.com` y un
   `fbclid`, y ~35 s después `facebookexternalhit` con el mismo `fbclid`. En el log de Vercel eso
   dice qué versión del sitio se evaluó. **No desplegar mientras hay una revisión abierta.**
9. **Un `<select>` cuyo valor no está entre sus opciones no muestra nada, y el primer clic lo
   borra.** Pasó con el radio de un pin: 12 km decía «Seleccionar…» y el primer clic escribía otro
   radio. El valor actual entra a la lista marcado «(actual)».
10. **Cada detalle de conjunto que se abre es una lectura más a Meta**, contra la cuota de la cuenta
    de **cada cliente**. El editor de público suma el alcance del selector.
11. **`vercel ls` escribe en stderr**: con `2>/dev/null` no ves nada y parece que no hubo deploy.
12. **Un guard que lee fuente pone en el error SU nombre, no el del archivo que mira.** Antes de
    culpar a un commit, grepeá qué archivo lee el test y comparalo contra `git show HEAD:<ese
    archivo>`. Esto ya costó acusar al commit equivocado de otra sesión.
13. **Hay varias sesiones de Claude sobre este mismo clon.** `git status` antes de tocar nada; lo que
    esté modificado y no sea tuyo, se deja. Commitear **por ruta explícita** (`git commit <ruta>`),
    nunca `git add -A`.

---

## Lo que espera una DECISIÓN DE MARTÍN

1. **Producto MÚLTIPLE por campaña** (punto 7 de su pedido del 05/10). Hoy una campaña se asigna a
   **UN** producto. Las opciones, con el argumento ya corregido (ver abajo):
   - **(a) Partir por conjunto** — cada conjunto a un producto. **Ya funciona hoy**, cero código.
   - **(b) Múltiple con prioridad** — la campaña en varios y el lead cae en el primero. Es un
     desempate silencioso.
   - **(c) El lead entra a VARIOS productos** — y esto **ya no cambia el modelo del CRM**: el modelo
     existe desde el 06/10 (`lead_funnel`, mig 0207). Lo que falta es cablearlo en la entrada de
     leads de Meta, que hoy resuelve UNO solo.
2. **Cómo se CREA un pin** (un punto en el mapa con radio). Hoy se leen, se ven y se les cambia el
   radio, pero no se puede crear uno. Dos caminos:
   - **(a)** pegar coordenadas o un link LARGO de Maps, con vista previa de OpenStreetMap en un
     iframe: **sin librería y sin costo** (falta agregar `frame-src` a la CSP, y que
     `pareceDireccion` no ofrezca una URL como si fuera una calle).
   - **(b)** un mapa para arrastrar el pin: con librería y con proveedor.
3. **Varias cuentas publicitarias en UN workspace (#799).** La pregunta previa no es técnica: desde
   el 28/09 la salida diseñada es la **cartera de agencia** (cada cliente de la agencia es su propio
   workspace con su propia cuenta). Si alcanza con eso, la tarea se cierra. Si se hace, son cinco
   cosas que tocan plata o datos — la peor: `upsertMetrics` **borra todas las filas de Meta de la
   fecha**, así que sincronizar una segunda cuenta se lleva puesto el rendimiento de la primera y se
   lee como «no gastó».
4. **La barra de lote: oscura o clara.** La del Ads Manager es oscura
   (`app/ads-manager/BarraAcciones.tsx:333`, `background: 'var(--ink)'`); la genérica del plan y del
   CRM es clara. Él sólo pidió radio y orden, así que no se tocó. Es una línea.
5. **Qué ve la persona cuando un reintento encuentra una publicación A MEDIAS.** Hoy: «Quedó a
   medias en Meta… revísalo en la tabla», y la misma clave sigue contestando eso hasta que algo del
   spec cambie.
6. **El `ⓘ` del chip «Con problemas» pasó a un ícono de ojo** por consistencia con la regla de «no
   emoji», y eso no estaba en su lista. Si no le gusta, se revierte en una línea.
7. **Las fixtures de lugares:** ¿se rehace la medición sobre su propia cuenta cuando ws9 tenga Meta,
   o alcanza con la forma sintética?

---

## CORREGIDO: dos afirmaciones del briefing viejo que eran FALSAS

### 1. «Falta aplicar la migración 0215» — ESTÁ APLICADA

Lo dicen todavía `app/admin/dev/ads-manager/bitacora.ts:26`, `:129`, `:130`, `:138` y
`docs/hallazgos-ads.md:3423` y `:3439`. **Medido el 10/10/2026 contra la base de producción**
(consulta de sólo lectura a `information_schema` y `pg_indexes`):

- `meta_campaign_drafts.idem_key` **existe**;
- `uq_meta_campaign_drafts_idem` existe: `CREATE UNIQUE INDEX … ON public.meta_campaign_drafts
  (workspace_id, idem_key) WHERE (idem_key IS NOT NULL)`.

Qué significa: el aviso de `f6ed4c33` («mientras falte la columna, "reintentar es seguro" es
FALSO») **ya no aplica** — la idempotencia está activa. Lo que sí sigue siendo cierto, y es dato
nuevo: **19 filas en la tabla y 0 con `idem_key`**, o sea que todavía no pasó ninguna publicación
real por ese camino. **Esos seis renglones del repo siguen sin corregir: no son de este archivo y no
los toqué.**

### 2. «Producto múltiple choca con que un lead tiene UN solo `funnel_id`» — dejó de ser cierto el 06/10

El argumento era: un lead vive en un solo embudo, así que una campaña en varios productos no tiene
dónde caer. Eso **dejó de ser verdad con `f26c0a94` (06/10/2026 18:49, migración 0207)**, que creó
la tabla **`lead_funnel`**: un lead tiene su *casa* (`leads.funnel_id`) y una fila por cada **otro**
producto donde está, con su etapa propia en ese tablero. El pedido textual de Martín ese día fue
«no se debe "Mover", se debe agregar al otro producto».

**Verificado el 10/10/2026 en producción:** la tabla existe con sus índices
(`lead_funnel_uk` único sobre `workspace_id, lead_id, funnel_id`) y tiene 2 filas.
`agregarAProducto` vive en `lib/lead-funnel.ts:58` y la llaman el opt-in de la landing
(`app/api/track/optin/route.ts:404`), el CRM (`app/crm/actions.ts:1056`), la bandeja de revisión y
la API de MaKo.

**Lo que SÍ sigue siendo cierto, y es lo que hay que decidir:** la **entrada de leads de Meta no usa
esa tabla**. Un lead de un formulario de Meta resuelve **UN** embudo y nada más —
`lib/leads.ts` → `funnelDeCampana` (`lib/campana-funnel.ts:93`) → `funnelIdDeCampana`
(`lib/campana-config.ts:148`, el conjunto gana a la campaña) — y escribe `leads.funnel_id`. Nadie
llama a `agregarAProducto` desde ahí. Así que la opción (c) de la decisión 1 **ya no es «cambiar el
modelo del CRM»: es agregar un call site en ese camino.** Y ojo con el otro lado: por diseño de la
0207, las métricas, el CAPI, el CRM automático, MaKo y la nutrición leen **sólo la casa**.

### 3. Dos cosas del briefing viejo que ya estaban resueltas y conviene no volver a abrir

- **«Operar desde un cliente da 403»**: cerrado el 07/10 con `db7b7682`. Verificado hoy en el
  código: `app/api/meta-write/route.ts:22` → `wsDeAdsManager()`, `lib/meta-write.ts:48` →
  `credWs('META_ACCESS_TOKEN', ws)`.
- **«El super admin escribe con el token de Mauricio sobre ids de otra cuenta»** (que el briefing
  viejo dejó como *sin verificar*): también lo cierra ese commit. `wsDeAdsManager()` →
  `adminDeWorkspaceActual()` → `getWorkspaceActual()`, que honra el `?ws=` de la pestaña, así que
  mirando a ws13 se escribe con las credenciales de ws13. **Lo que queda es la trampa 1 de arriba:
  cuando NO hay workspace resuelto, cae al ws1.**

---

## Instagram: la tab está AFUERA, el canal VOLVIÓ

Dos decisiones de Martín que no se contradicen, y conviene no confundirlas:

- **06/10/2026 — «C: sacar la tab».** Se fue entera: la bandeja de DMs, el programador de
  publicaciones, el puente de los DMs al setter y sus 21 operaciones de la API de MaKo (`8d16c6ff`,
  #792). Medido ese día en producción: **0 conversaciones, 0 mensajes y 0 publicaciones** en toda su
  historia. `app/instagram/page.tsx` **sólo redirige** a `/automations` (desde el 09/10, directo, sin
  pasar por `/chatbot`): se redirige y no se borra porque hay links viejos afuera del repo.
- **09/10/2026 — vuelve como CANAL de las automatizaciones, por Zernio**, junto con Messenger
  (`d11aa86f`, `87b32895`). Su detalle **no vive acá**: está en los hallazgos y el relevo del
  Chatbot/Automations. Lo que toca a esta área, en tres renglones:
  - **Instagram NO es el WhatsApp no oficial: ahí SÍ manda la ventana de 24 h de Meta.**
  - Una app usa Facebook Login **O** Instagram Login para los permisos de Instagram, no las dos. La
    app MaKo ya usa Facebook Login for Business, así que Instagram entra por ahí y exige página
    vinculada.
  - **`pages_manage_metadata` no puede seguir afuera del App Review**: lo exige toda suscripción de
    webhook de página (DM, comentarios y el de leads en vivo).
  - `tests/sin-instagram.test.ts` fija **en positivo**, archivo por archivo, quién puede hablar con
    Zernio. Un archivo nuevo que lo haga es una decisión, no un arreglo.

---

## Archivos del área

**La pantalla:** `app/ads-manager/**` — el 90% vive en `CampanasBrowser.tsx` (~1.250 líneas) y
`BarraAcciones.tsx`. Los modales: `NuevaCampanaModal`, `AgregarConjuntoModal`, `AgregarAnuncioModal`,
`EditarTextosModal`, `EditarPublicoModal`, `EntityDetalle`, `LugarPicker`, `LugaresLectura`,
`MisCreativosMako`, `CrearFormulario`, `ProductoCelda`.

**Las libs:** `lib/meta-ads-create.ts` (crea en Meta), `lib/meta-write.ts` (pausa/presupuesto/
renombre/borrado), `lib/meta-health.ts` + `lib/meta-health-ui.ts` (el árbol y su caché),
`lib/meta-geo.ts` (lugares), `lib/meta-idempotencia.ts`, `lib/presupuesto-cambio.ts`,
`lib/moneda-meta.ts`, `lib/creativo-mako.ts`, `lib/ads-guard.ts`, `lib/ads-staging.ts`,
`lib/meta-publicar-errores.ts`, `lib/ganadores-reuso.ts`, `lib/campana-asignar.ts`,
`lib/meta-formularios.ts`, `lib/meta-pais.ts`.

**La conexión con Meta:** `lib/meta-login.ts`, `lib/meta-conexion.ts`,
`app/api/integraciones/meta/route.ts` y `/callback/route.ts`.

**Las rutas:** las 15 de `app/api/ads-manager/` (todas cortan con `guardAdsWs()`) y
`app/api/meta-write/route.ts` (que vive afuera de esa carpeta y **también lo usa el doer de MaKo**:
mirá con qué workspace lo llama ese camino antes de tocar de dónde sale el token).

**Compartidos — hablá antes de cambiar firmas:** `app/crm/campanas-actions.ts` y
`lib/campana-config.ts` (son del CRM), `app/components/Dropdown.tsx`, `app/_ui/Confirm.tsx` (lo usan
más de 14 pantallas).

**Tests:** `tests/ads-barra.test.ts`, `tests/ads-presupuesto-confirma.test.ts`,
`tests/ads-creativo-mako.test.ts`, `tests/creativo-mako.test.ts`, `tests/meta-geo.test.ts`,
`tests/ads-lugares-conjunto.test.ts`, `tests/meta-login.test.ts`, `tests/moneda-meta.test.ts`,
`tests/campana-asignar.test.ts`, `tests/_emoji.ts`, `tests/sin-instagram.test.ts`.

**Dónde está cosechado el detalle:** `docs/hallazgos-ads.md` (grepeá la ruta que vas a tocar, nunca
lo abras entero), `AGENTS.md` (las reglas que gobiernan código nuevo) y
`app/admin/dev/ads-manager/bitacora.ts` (los pedidos textuales de Martín).

---

### Trabajo de OTRA sesión que estaba sin commitear el 10/10 y toca de refilón esta área

Al escribir esto, `git status` mostraba cambios ajenos (del chat del CRM, no míos, y no los toqué).
Dos importan acá: **`lib/campana-atribucion.ts`** —que usa la MISMA precedencia conjunto > campaña
que `funnelIdDeCampana`, así que si cambia una, la otra tiene que mirarse— y
**`tests/crm-filtro-ads.test.ts`**. Los otros eran `app/crm/CrmBoard.tsx`,
`app/crm/CrmToolbar.tsx` y un `app/crm/arbol-seleccion.ts` nuevo. Si algo de lo que afirmo sobre la
atribución de campañas no cierra, lo primero es `git log -1 -- lib/campana-atribucion.ts`: pudo
entrar después de esta medición.
