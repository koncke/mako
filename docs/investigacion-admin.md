# Cómo resuelven otras apps un panel de administración: qué copia la tab Admin (5/11/2026)

Lo pidió Martín: «que lo copies completamente de otras aplicaciones… qué acciones hacen los usuarios dentro de MaKo, cuándo
se conectan, qué no están utilizando… cuándo la app se crashea… suscripciones, cobros, gestión de usuarios, estado de alta».
El encargo está en [relevo/admin-encargo.md](relevo/admin-encargo.md). Las 16 capturas del rediseño de Customers (26/10) siguen
en [customers/referencias/otras-apps/LEEME.md](customers/referencias/otras-apps/LEEME.md) y valen igual.

**De dónde salió cada dato.** Desde la nube no se pueden abrir docs.stripe.com, help.baremetrics.com, help.chartmogul.com,
posthog.com, docs.sentry.io, amplitude.com ni intercom.com (el proxy los bloquea). Se leyeron palabra por palabra los docs
que están en GitHub (PostHog, Sentry, Lago, Clerk, Tidemill) y el código de GlitchTip, Umami y shadcn-admin. Lo de Stripe,
Baremetrics, ChartMogul, Amplitude e Intercom sale de resúmenes de búsqueda y de las capturas del 26/10: va marcado
«(búsqueda)». Lo no verificado lleva ⚠️.

## Qué se copia, sección por sección

| Sección | Se copia de | Licencia del código | Qué se toma |
|---|---|---|---|
| **Revenue** | ChartMogul (gráfico de movimientos), Lago (tabla de saldos) y Tidemill (las cuentas) | Lago AGPL: sólo mirar. Tidemill MIT. ChartMogul es cerrado | Las cuentas se escribieron de cero con las definiciones de Tidemill. Del resto, sólo el diseño |
| **Billing** | La página del cliente de Stripe y el informe de facturas de Lago (la deuda por antigüedad) | Cerrado / AGPL: sólo mirar | La estructura |
| **Customers** | Baremetrics y Polar (la ficha), ProfitWell (lo que pide atención). Ya copiado el 26/10 | Cerrado | Se queda |
| **Users** | La tabla de usuarios de shadcn-admin y el perfil de Clerk | shadcn-admin MIT: se puede copiar | Columnas, estados y botones |
| **Activity** | El ciclo de vida y la lista de personas de PostHog; el perfil de Umami | PostHog MIT (fuera de `ee/`). Umami MIT | Los tipos de actividad y el perfil |
| **Errors** | La lista de problemas de Sentry, con el código de GlitchTip | Sentry FSL: sólo mirar. GlitchTip MIT | La fila y los estados |

Las AGPL (Lago, Plausible, OpenPanel, Metabase, Cal.com, Plane, Documenso) y la FSL de Sentry se miran y nunca se copian. Al
copiar código MIT o Apache se conserva su aviso (`lib/avisos/LEEME.md`) y se nombra en el commit.

## Revenue: lo que entra (la primera en salir)

**Por qué la de hoy no lo mostraba.** Medido el 5/11:
- El MRR salía de `cobros` (la pasarela), y ahí hay 2 filas, las dos pendientes.
- Todo lo que Martín cobró entró a mano y vive en `pagos` del CRM de la plataforma.
- Ese CRM tiene vacío el `suscripcion_monto_usd` en los tres clientes, así que `getMrrActivo` tampoco suma nada.

Las apps de referencia lo resuelven separando dos cosas:
- **el MRR**, que sale de la suscripción facturada;
- **el cash**, que es lo que entró.

ChartMogul y Baremetrics aceptan pagos fuera de la pasarela («Custom Source», CSV o API) como facturas. Stripe los marca
«paid out of band». En MaKo esas facturas son los pagos a mano del CRM.

**Lo que se copia:**
1. **Arriba, la foto de hoy** (Lago la llama «photo of today»; Baremetrics, Control Center):
   - el MRR grande con su «desde» y el % contra el cierre del mes pasado;
   - lo cobrado este mes;
   - lo cobrado desde siempre («Lifetime revenue», el nombre de Clerk; Baremetrics lo llama «total charges»);
   - cuántos pagan y el promedio por cliente (ARPU).

   Sin pagos, no hay tarjetas en cero: una línea dice qué hacer.
2. **El MRR mes a mes y sus movimientos** (ChartMogul):
   - una barra por mes, y el mes en curso rayado en diagonal porque todavía no cerró (AGENTS.md: el rayado es «no medido»);
   - debajo, la tabla de Lago: MRR al empezar, nuevo, volvió, subió, bajó, se cortó, y MRR al cerrar. Cada mes cierra exacto.
3. **Cobrado por mes:** el cash, con la misma barra. Lago avisa que un gráfico de plata que entró no se lee como un saldo:
   por eso va aparte y con su nombre.
4. **Lo que viene:** cada suscripción viva con su vencimiento, atrasada o en los próximos 31 días. El atraso también se ve en
   la deuda de Lago (1-30, 31-60…).
5. **Actividad:** el feed de ProfitWell (captura 02). Un renglón por movimiento, con su etiqueta de color y el monto con signo.
6. **Los clientes:** la lista de Stripe y Baremetrics con lo que paga por mes, el total pagado, desde cuándo, su estado y el
   próximo cobro. La ficha es la de ChartMogul: MRR, «cliente que paga desde» y estado.
7. **Los últimos pagos:** como «Payments» de Stripe, con el medio real (transferencia, Binance, Stripe).

**Las cuentas** (las mismas en ChartMogul, Baremetrics, Lago y Tidemill). Se compara el MRR de cada cliente al cerrar el mes
con el del mes anterior:

| Movimiento | Regla |
|---|---|
| Nuevo | antes 0, y nunca pagó |
| Volvió | antes 0, y ya había pagado alguna vez (Baremetrics: «una suscripción nueva de un cliente que había cancelado») |
| Subió | ahora más que antes, con antes > 0 (subir de plan o un segundo lugar) |
| Bajó | 0 < ahora < antes. Sacar uno de varios lugares es bajar, no cortar (ChartMogul, Lago) |
| Se cortó | ahora 0 |

MRR al cerrar = MRR al empezar + nuevo + volvió + subió − bajó − se cortó. En qué se diferencian las apps:
- Lago no tiene «volvió»: un cliente que vuelve le cuenta como «subió».
- ChartMogul deja elegir cuándo se corta: al cancelar o al terminar el período pagado.
- Stripe cuenta como MRR las suscripciones `past_due` (atrasadas).

**Lo que se decidió para MaKo, y por qué:**
- **El monto de cada mes es lo que pagó, no el precio del plan** (decisión del 25/10, hallazgos-customers.md). Un pago a mano
  registrado como la mensualidad cubre un mes desde su fecha. Uno nuevo REEMPLAZA al anterior desde ese día: así sube o baja.
- **Dos pagos a menos de 7 días son UN cobro.** Código pagó noviembre en dos (94 el 4/11 y 144 el 5/11): es una mensualidad de
  US$238, no dos meses.
- **La gracia es de 15 días, como el `past_due` de Stripe.** Quien paga tarde sigue contando (atrasado). Si renueva adentro de
  la gracia no hubo corte. Pasada la gracia, el corte se anota el día que venció (el «al terminar el período pagado» de
  ChartMogul).
- **Lo suelto no es MRR.** Un pago suelto, el diferencial de un cliente nuevo o una venta de pago único suman al cash y al
  total del cliente, nunca al MRR (decisión de Martín: el MRR no infla lo cerrado).
- **El LTV proyectado no se muestra.** Clerk lo calcula como MRR promedio dividido por la tasa de corte, y con 3 a 20
  clientes ese número es ruido. Se muestra lo cobrado de verdad.

## Billing: suscripciones, deudas, próximos cobros y recibos

Copia la página del cliente de Stripe (búsqueda) y el informe de facturas de Lago:
- **Stripe, dos columnas:** a la izquierda las suscripciones (también las canceladas), los pagos y las facturas; a la
  derecha los datos y el resumen de lo comprado. Un botón «Actions».
- **Lago:** el estado del pago (pendiente, pagado, falló), la deuda por antigüedad (1-30, 31-60, 61-90, 91-120, más de 120
  días, y «todavía no vence» al final) y el total adeudado por moneda, sin sumar monedas.

⚠️ No apareció ninguna referencia de una lista de «próximos cobros» ni de una pantalla de recibos. «Lo que viene» de Revenue es
la versión de ChartMogul del vencimiento. Los recibos los arma otro chat (`punta/recibos`, `app/admin/cobros/RecibosMako.tsx`) y
esta tab los monta.

## Users: gestión y estado de alta

Copia la tabla de usuarios de shadcn-admin (MIT: `src/features/users/`) y el perfil de usuario de Clerk.

**La tabla:**
- casilla, nombre, email, estado, rol, negocio y menú de la fila (sin el teléfono: lo tiene el CRM);
- los cuatro estados de shadcn-admin con su color: **active**, **inactive**, **invited** y **suspended**. En MaKo:
  - activo: entró en 30 días;
  - inactivo: no entra hace más;
  - invitado: nunca entró;
  - suspendido;
- filtros por estado y por rol, y arriba «Invite user».

**El perfil:**
- datos, identificadores y negocios;
- acciones: entrar como esa persona, bloquear, suspender y borrar;
- lo que pagó (MRR y lo cobrado en total).

**Cómo lo hace Clerk:**
- «Ban» corta todas las sesiones y no deja entrar de nuevo.
- «Lock» es temporal.
- «Impersonate» abre la app como esa persona en otra pestaña, con un vencimiento, y la app sabe que es una sesión prestada.

En MaKo eso es «Inspeccionar» (`/inicio?ws=N`) y la suspensión por persona (`usuarios.estado = 'suspendido'`).

## Activity y Usage: qué hacen, cuándo entran, qué no usan

Copia PostHog: el ciclo de vida, las personas y el «uso por empresa»:

1. **Arriba**, los activos del día, la semana y el mes (DAU, WAU, MAU) y los más activos de los últimos 30 días.
2. **El ciclo de vida, en barras por semana.**
   - Arriba del cero: los **nuevos**, los que **siguen** y los que **volvieron**.
   - Abajo del cero: los que **dejaron de entrar**.
   - Un clic en una banda abre la lista de esas personas.
   - Amplitude suma el «Pulse»: (nuevos + volvieron) / dejaron. Más de 1 es que entra gente más rápido de lo que se va.
3. **Quién dejó de venir:** la lista de la banda de abajo, con las columnas de PostHog: persona, alta, última vez.
4. **El uso por tab y por negocio:** una columna de uso por cada tab (cuántas veces en 7, 30 o 90 días), como las «usage
   metrics» de PostHog. ⚠️ No apareció una grilla tab × negocio en ninguna app: la más cercana es la lista de clientes con una
   columna por función.
5. **El perfil de una persona**, de Umami:
   - una tira de números: visitas, pantallas y acciones;
   - primera y última vez;
   - una pestaña «Activity», agrupada por día: «Abrió CRM», «Movió un lead».

**Lo que falta medir:** MaKo no guarda qué pantallas se abren ni qué acciones se hacen (sólo `usuarios.ultimo_login`).
PostHog lo resuelve con eventos («pageview» y uno por acción). En MaKo va un registro propio, por lotes y con retención, sin
contenido de leads ni mensajes. Su diseño está en el relevo de la tanda.

## Errors: cuándo se cae la app y los reportes

Copia la lista de problemas de Sentry (docs en GitHub) con el código de GlitchTip (MIT, compatible con Sentry):

- **La fila** (verificada en `issues-page.html` de GlitchTip): el título del error y, en una segunda línea, «hace N días · visto
  hace X», las veces y una mini tendencia.
- **Las pestañas:** sin resolver, nuevos (de los últimos 7 días), volvieron (estaban resueltos) y archivados.
- **El orden:** última vez, primera vez, más frecuentes.
- **El detalle,** en el orden de Sentry:
  1. el mensaje, las veces y a cuántas personas les pasó;
  2. el gráfico de veces;
  3. el primero y el último;
  4. en qué pantalla y en qué negocio;
  5. el stack.
- **Los tickets** van al lado de los errores de esa persona o ese negocio, como en el perfil de cliente de PostHog.

MaKo ya agrupa los errores por huella (`errores_app`, lib/errores-app.ts): la pantalla los muestra y nada más.

## Repos mirados y su licencia

Leídos de su archivo LICENSE el 5/11/2026:

| Repo | Licencia | Para qué | Veredicto |
|---|---|---|---|
| umami-software/umami | MIT | Tabla y perfil de una sesión | Se puede copiar |
| PostHog/posthog | MIT, salvo `ee/` | Ciclo de vida, retención, personas | Sólo fuera de `ee/` |
| satnaing/shadcn-admin | MIT | Tabla de usuarios con estados | Se puede copiar |
| Kiranism/next-shadcn-dashboard-starter | MIT | 4 números arriba, gráficos y ventas recientes | Se puede copiar |
| tremorlabs/tremor | Apache-2.0 | Gráficos | Se puede copiar |
| GlitchTip (gitlab.com/glitchtip) | MIT | Lista y detalle de errores | Se puede copiar |
| ondraz/tidemill | MIT | Definiciones de MRR, corte y LTV | Se puede copiar |
| killbill/killbill | Apache-2.0 | Motor de cobro | Se puede copiar |
| chatwoot/chatwoot | MIT, salvo `enterprise/` | Perfil de un contacto | Sólo fuera de `enterprise/` |
| getsentry/sentry | FSL-1.1 | Problemas | Sólo mirar |
| getlago/lago | AGPL-3.0 | MRR y facturas | Sólo mirar |
| plausible/analytics, Openpanel-dev/openpanel, metabase/metabase | AGPL-3.0 | Analítica | Sólo mirar |

En la tanda 1 no se copió código de ningún repo: las cuentas de Revenue se escribieron de cero (lib/admin-ingresos-reglas.ts)
con las definiciones de la tabla de arriba, y la pantalla sigue el lenguaje visual de Customers.
