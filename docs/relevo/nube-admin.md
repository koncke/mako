# Relevo — la tab Admin (nube, 5/11/2026)

> Lo escribe la sesión de la nube que hace el encargo [admin-encargo.md](admin-encargo.md) (cuenta `nube`, sesión
> `cli_efae8d7b-8598-5f74-a2e3-3aef4e3f73e1`). Se reescribe en cada tanda. Lo de Martín, textual, está en el encargo y en la
> bitácora del área (app/admin/dev/admin/bitacora.ts).

## Lo que ya está subido

| Tanda | Qué | Dónde está (5/11, 22:40 UTC) |
|---|---|---|
| 1 | La investigación (docs/investigacion-admin.md). La tab se llama **Admin** y vive en `/admin`; abre en **Revenue** con lo cobrado de verdad. | en main |
| 2 | **Users** (las personas de todos los negocios con su estado de alta, entrar, reenviar el acceso, suspender) y **Errors** (los errores agrupados como Sentry y los reportes). Accounts pasa a ser la otra vista de Customers. | en main |
| 3 | **Activity**, con la medición que faltaba: quién entra cada día, semana y mes, quién entra cada semana (nuevos, siguen, volvieron, dejaron), qué tabs se usan y cuáles nadie abrió, cada negocio con lo que más usa, quién dejó de entrar y lo último que hizo MaKo. Al pie, lo que era Agents. | `punta/admin`, esperando la corrida de GitHub |

La primera corrida de la tanda 3 dio rojo (`ci-rojo/admin`, run 42119084126) por un test ajeno: `tests/resend-clave-admin.test.ts` lista el
repo entero con git sin tope de salida, y la lista pasó 1 MiB con los archivos nuevos. Se arregló ahí y en `tests/puente-leads-retirado.test.ts`,
que tenía lo mismo. El chat de los recibos lo arregló igual el mismo día y ya está en main (docs/hallazgos-infra.md, «La lista de archivos
del repo entero pasó el megabyte»). Si otra punta da ENOBUFS en un test que lista todo, es esto: la cura es `maxBuffer`.

La barra de Admin queda en seis: Revenue · Billing · Customers · Users · Activity · Errors. `?tab=accounts` abre la vista de
tarjetas de Customers y `?tab=agents` abre Activity (los links viejos siguen andando).

## Lo que le toca al Cerebro (en producción, que la nube no ve)

1. **Aplicar la migración `0398_actividad_uso`** (agrega dos tablas y una función; no toca nada que exista). **El número se
   confirma al aplicarla:** el 5/11 main llegaba a 0394, había una 0396 en `punta/codigo-primer-contacto` y una 0397 propuesta
   para los recibos. Si ya está tomado, se renumera el archivo antes de aplicarla. Va **antes o junto** con el deploy: sin ella,
   la medición no escribe nada (sin romper nada) y Activity dice «Todavía no se mide el uso: falta aplicar la migración 0398».
   Para comprobarla: `has_function_privilege('anon', 'sumar_actividad(date,bigint,bigint,text,integer,integer)', 'execute')`
   tiene que dar `false`.
2. **Cargar lo de noviembre de Código Inmobiliario** en su ficha del CRM de la plataforma (lead 2474), como dos pagos
   «Mensualidad» con medio Binance: US$94 el 4/11 y US$144 el 5/11. Con eso Revenue muestra MRR US$432 y «Subió +US$92». Si el
   chat de la suscripción en la ficha (`punta/suscripciones-ficha`) ya cambió cómo se registra, se carga como diga su relevo.
3. **Mirar Revenue en producción** cuando la punta llegue a main: `/admin`. Lo esperado con lo medido el 5/11 (sin noviembre
   cargado): MRR US$340, cobrado en octubre US$340, tres clientes al día y lo que viene: Florencia el 18/11, Leila el 26/11 y
   Código el 21/11. Si un número no da, lo primero es ver si esos pagos están con `pagado = true` y `fecha_pago`.
4. **Si alguno de los tres no tiene `leads.cliente_ws`** (su cuenta de MaKo), Revenue lo muestra con «sin cuenta en MaKo» y
   lleva a su ficha del CRM en vez de la del negocio. Se arregla vinculando la cuenta desde la ficha del cliente.
5. **Mirar Users, Errors y Activity en producción:** `/admin?tab=users`, `/admin?tab=errors` y `/admin?tab=activity`. En Users,
   los «invitados» con «Nunca se le mandó el acceso» son personas con cuenta que nunca supieron que la tenían: se les reenvía
   desde el menú de la fila. En Activity, «Dejaron de entrar» ya tiene datos (sale del último ingreso); lo demás arranca vacío y
   se llena cuando la gente de los negocios abre la app.
6. **Un vistazo a la frase nueva de la política de privacidad** (`/privacidad`, «Cómo usas el producto»): dice que MaKo cuenta
   qué secciones abre cada persona y cuántas acciones hace, sin guardar lo que escribe ni lo que ve, que lo mira sólo el equipo y
   que se borra a los 400 días (90 lo de MaKo). La fecha de la política pasó al 5 de noviembre.

## Lo que supuse (sin `docs/relevo/admin-medicion.md`, que todavía no llegó a main)

- Que los pagos de los tres están en `pagos` del negocio de la plataforma con `es_mensualidad = true` (lo dice el encargo de la
  suscripción). Si alguno es una cuota del plan, igual cuenta: la cuota del plan de un lead de suscripción es recurrente.
- Que `fecha_pago` es el día que entró la plata (no el de la cuota esperada).
- **La medición la diseñé yo** (el relevo de la medición no llegó): contadores por persona, tab y día, y un renglón por operación
  de la API de MaKo. Si ese relevo pide otra cosa (eventos uno por uno, otra retención), cambian `lib/actividad-registro.ts` y la
  migración; la pantalla lee `vistaDeActividad` y no sabe de dónde sale.

## Con quién se cruza

- **`punta/suscripciones-ficha`**: si cambia cómo se guarda una suscripción, en Revenue cambia una sola función,
  `esRecurrente` (lib/admin-ingresos.ts). Las cuentas no saben de dónde sale cada pago.
- **`punta/recibos`**: llegó a main el 5/11 y monta `RecibosMako` en Billing (`app/admin/cobros/Contenido.tsx`), con sus tres
  operaciones de la API. Esta sesión no movió `app/admin/cobros/` (sólo cambió dos links a `/admin?tab=billing`).
- **Quien toque `app/_components/WsFetch.tsx`, `Sidebar.tsx` o `app/m/_ui/ShellM.tsx`**: ahí viven el contador de acciones y el
  medidor. Y `lib/api-mako/ejecutar.ts` ahora envuelve a `correrOperacion` para anotar lo que hace MaKo.

## Decisiones que tomé (Martín puede cambiarlas)

- **Suspender a una persona no va por la API de MaKo**, sólo por la pantalla: apaga sus tokens, y un token filtrado no puede
  dejar sin acceso a nadie. La API lee (`ver_personas_de_mako`, `ver_errores_de_mako`, `ver_actividad_de_mako`).
- **Accounts no es una pestaña**: es la vista de tarjetas de Customers (el selector de vista). La barra queda en seis.
- **Agents vive al pie de Activity**: lo que los agentes de los clientes le contaron a MaKo es parte de «qué hacen».
- **Ni el super admin ni el equipo de la plataforma se miden**: su uso no es de un negocio, y mirando a un cliente ensuciaría el
  del cliente.
- **Activity no muestra quién hizo cada cosa, uno por uno**: muestra cuántos y qué tabs. Lo uno por uno (el pedido de Martín del
  13/10, «registro de todas las acciones que hace un usuario») sería un historial con contenido, y el encargo dice «qué se hizo,
  no qué decía». Si lo quiere, es otra tanda.

## Lo que falta

- **Usage como pestaña aparte**: quedó adentro de Activity («Qué tabs se usan» y «Cada negocio»), copiado de las usage metrics
  de PostHog, que también las muestran juntas. Si Martín la quiere aparte, son las mismas cuentas en otra pestaña.
- **Lo que hace cada persona en la ficha de su negocio** (Customers): `vistaDeActividad` ya lo tiene por negocio; falta dibujarlo
  en la ficha.
