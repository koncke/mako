# Admin: lo que mide producción y la tab no ve (medido el 5/11/2026, ~20:50 UTC)

Base de producción, sólo lectura. Código leído de `origin/main` al 5/11. «Medido» = salió de la base o del código; «deducido» = lo concluyo yo; «no medí» = no pude. No vi la pantalla en un navegador: lo que dice qué muestra la tab es deducido del código con estos datos.

## 1. Ingresos reales de la plataforma

**Medido.** `pagos` del negocio 9 (3 filas, todas pagadas, método `transferencia`, `es_mensualidad`, cargadas el 26/10) y `cobros` (2 filas, ninguna pagada):

| Cliente (negocio) | Octubre | Noviembre (hasta el 5/11) | Total |
|---|---|---|---|
| Leila Fittipaldi (11) | 97 el 26/10 | 0 | 97 |
| Código Inmobiliario (13) | 146 el 21/10 | 238 (94 el 4/11 + 144 el 5/11, USDT) **no está en la base** | 384 |
| Florencia Carballo (21) | 97 el 18/10 | 0 | 97 |
| **Total** | **340** | **238** | **578** (340 en base + 238 a mano) |

- Los 238 de Código son lo que dijo Martín; no hay fila. El `total_cobrado_usd` de su lead sigue en 146.
- `cobros`: 2 suscripciones de Mercado Pago (ids 1 y 2, planes `esencial` y `pro`, 31/10), estado `pendiente`, sin `pagado_at`, con `alta_ws` y `cliente_ws` en null. Cobrado por pasarela hasta hoy: 0.
- `pasarela_eventos`: 16 filas, todas Stripe `checkout.session.expired`, estado `ignorado`, la última el 5/11. Nadie pagó por Stripe; hubo 16 checkouts que vencieron.
- Los 3 leads pagantes tienen `suscripcion_monto_usd` y `suscripcion_meses` en null. El lead de Florencia tiene `cliente_ws` en null (los de Leila y Código apuntan a 11 y 13): su pago no se puede atribuir a su cuenta por dato, sólo por nombre.
- Los pagos manuales tienen `moneda` y `monto_original` en null: los USDT de Código se tratan como dólares sin dejar rastro de la moneda.
- Otros negocios tienen sus propios `pagos` (1: 36 pagados, 11: 10, 13: 0 pagados). Son cobros de SUS clientes, no ingreso de MaKo. No se suman.

**Qué muestra hoy la tab (deducido del código).**
- `lib/clientes-plataforma.ts` calcula el MRR sólo con `cobros` que tengan `alta_ws` o `cliente_ws` y estén `activa` (`cobrosDeLugares` + `factura`). Los 2 que hay no cumplen ninguna condición: MRR = 0, «pagan» = 0 y la columna MRR no se dibuja.
- El «cobrado por mes» sí lee `pagos` del negocio 9 (`cuotasDeLaPlataforma`). Da octubre 340 y los demás meses 0.
- `CustomersApp.tsx` (`Plata`): con MRR 0 el número grande es el del mes en curso. Hoy muestra «Lo que entró este mes · US$ 0» con una barra de 340 en octubre. La comparación contra el mes anterior no aparece (septiembre 0). No hay total, ni por cliente, ni por forma de pago.
- El texto de «sin plata» dice «tus clientes tienen el plan dado a mano»: no hay ni una fila `plan.a_mano` en `app_settings`, así que es falso.

**Por qué no coincide.** (1) Los noviembre de Código no están cargados. (2) El número grande es el mes en curso, no el cobrado ni el MRR. (3) El MRR depende de `cobros`, donde no entra lo manual. (4) No existe vista por cliente.

**Con qué fuente (deducido).** El libro es `pagos` del negocio 9 (`pagado` y `fecha_pago`), porque un pago de pasarela también cae ahí con `cobro_id` (`lib/cobros.ts`, `lib/pasarela-eventos.ts`): sumar `cobros` pagados más `pagos` contaría dos veces. `cobros` sirve para el estado (pendiente, activa, fallida, próximo cobro), no para sumar. Cliente = `leads.cliente_ws` del lead del pago. Como `suscripcion_monto_usd` falta, el MRR de un cliente tiene que salir de sus pagos mensuales recientes y no de ese campo; Código cambia de monto cada mes (146, 238, y el otro chat espera 426 en diciembre). Hay que cargar los 2 pagos de noviembre y el `cliente_ws` de Florencia (lo repara el Cerebro, no la tab).

## 2. Lo que hace hoy la tab

Ruta `/customers?tab=`, menú `admin-customers` («Customers») en `nav.ts`, guarda `SOLO_ADMIN` en `proxy.ts` y `getSesionAdmin()` en la página. `SUPERADMIN_MENU` hoy sólo lleva `conocimientos`.

| Pestaña | Qué hay | De dónde lee |
|---|---|---|
| **Customers** | Plata, 3 números (clientes, entraron esta semana, nuevos 30 días), «Para mirar» (8 motivos: pausado, cobro, pago, regalo, sin-uso, sin-empezar, prueba, nuevo), chips Todos/Clientes/Partners/Agencies/De agencias, buscador, tabla Cliente·Grupo·Última vez·Leads·MRR·Estado, ficha lateral (plan, grupo, configuración, plata, pago, último lead, sesiones del agente), clic derecho (ver ficha, entrar, administrar) | `lib/clientes-plataforma.ts`: `workspaces`, agencias y carteras, `partner_codigos`, `cobros`, `usuarios.ultimo_login`, onboarding en `app_settings`, conteo y último de `leads`, `agente_sesiones`, `pagos` del 9, `plan.a_mano` |
| **Accounts** | `AdminView` incrustado: tarjetas o tabla, filtros (todos, activos, pausados, sin equipo, por plan), orden, ventana de alta, exportar CSV. Nuevo cliente (crea negocio + admin + mail). Por negocio: Inspeccionar (`/inicio?ws=`), renombrar, cambiar permisos o plan (manda mail; plan a mano 7/14/30 días o 6 meses), pausar o activar, eliminar escribiendo el nombre, portada e icono. Ficha: tablero del trabajo de Martín para ese cliente (`PlanBoard`), Equipo (alta, reinvitar, mover de negocio, rol, foto, suspender, eliminar) y computadoras con Desconectar. Arriba, si hay algo: aprobaciones de agencia, «Quieren entrar», «Pidieron eliminar su cuenta» | `/api/admin/workspaces`, `/api/admin/usuarios`, `/api/admin/agencia(+altas)`, `/api/admin/pedidos-ingreso`, `/api/admin/bajas-cuenta`, `filasDeTodos`, `clientesGanados`, centro de operaciones (computadoras) |
| **Billing** | Vender un plan (asistente: plan, pasarela, monto, quién paga, link), lista de cobros con estado del cobro y del alta (anular, reembolsar con «cortar suscripción», atar a su cuenta, cancelar suscripción), precio del cliente de agencia (US$47 + monto en MP), precios de planes en la moneda de MP | `cobros` (`listarCobros`), pasarelas conectadas, `app/admin/cobros/actions.ts` |
| **Agents** | Sesiones del Claude Code de los clientes | `agente_sesiones`: **0 filas**, siempre vacío |

**Vital que no se pierda:** Inspeccionar; alta de cuenta con su mail; cambio de plan y plan a mano; pausar; eliminar con sus guardas (`motivoNoEliminable`); equipo y suspender; **«Pidieron eliminar su cuenta»** (Apple y Play lo exigen y hay un plazo prometido); «Quieren entrar»; aprobaciones de agencia (es una guarda de seguridad: dos personas deciden); Vender plan, anular, reembolsar, cortar suscripción; precios de MP y de agencia; Desconectar computadoras; exportar CSV con su escape; cartel de lo que espera.

**Qué más enlaza** (a `/customers`, `/admin`, `/admin/cobros`, `/admin/agente`):
- `app/admin/page.tsx`, `cobros/page.tsx`, `agente/page.tsx`: redirects a `/customers`.
- `app/inicio/page.tsx` (sin negocio cae a `/customers`), `lib/agencia-cartera.ts` (salida del super admin), `lib/pedidos-ingreso-reglas.ts` (`RUTA_QUIEREN_ENTRAR`), `lib/funciones-mako.ts` (key `admin-customers`).
- Teléfono: `lib/movil-rutas.ts` mapea `/customers`, `/admin/cobros`, `/admin/agente` a `/m/customers`, `/m/cobros`, `/m/agente`; `app/m/cobros/CobrosM.tsx` manda a `/admin/cobros`.
- API de MaKo: `ver_clientes_de_mako` en `lib/api-mako/areas/cobros.*`; `operaciones.run.ts` lee `errores_app`.
- `nav.ts`: `HERRAMIENTAS.agente` y `.cobros` siguen declaradas; `match` de `admin-customers` cubre las tres rutas.
- `/admin` también cuelga de ahí: `operaciones`, `estrategia`, `offer-playbook`, `runway`, `friccion`, `guiones`, `copywriting`, `docs`, `ui`, `rediseno`, `dev`; `ads-manager/*` manda «Ir al panel» a `/admin`. `/admin/*` y `/api/admin/*` siguen bajo `SOLO_ADMIN`.
- Tests que lo nombran: `admin-cobros`, `admin-view-props`, `customers`, `clic-derecho-listas`, `baja-cuenta`, `csv-una-sola-via`, `cliente-de-agencia-y-partners-2910`, `cobro-lanzamiento`.

## 3. Actividad y uso: qué datos existen de verdad

**Medido.** Filas y última fecha:

| Tabla | Filas | Primera | Última | Qué es |
|---|---|---|---|---|
| `errores_app` | 8 (11 apariciones) | 18/10 | 4/11 | errores agrupados |
| `lead_audit` | 20.030 | 15/11/2025 | 5/11 | cambios de campos de leads; **autor = correo** en 13.006 filas |
| `credenciales_auditoria` | 336 | 16/7 | 4/11 | guardar/revelar/borrar claves (6 revelar y 1 guardar denegados) |
| `mfa_eventos` | 32 | 14/10 | 4/11 | entradas y 2FA |
| `ticket_eventos` / `tickets` | 295 / 55 | 18/10 | 4/11 | 3 abiertos, 52 resueltos (29 h promedio) |
| `offer_sesiones` | 51 | 12/10 | 30/10 | chats de Offer |
| `agente_sesiones` | **0** | | | plugin del cliente: nadie lo activó |
| `chat_eventos` | 2 | 18/10 | 18/10 | casi vacía |
| `replay_sesiones` | 376 | 7/10 | 5/11 | **grabaciones de las landings** (negocios 1, 9, 11), no de la app |
| `anthropic_usage` | 11.632 | 29/6 | 5/11 | cada llamada de IA, por negocio y función |
| `api_llamadas` | 976 | 8/10 | 3/11 | llamadas a la API de MaKo (69 fallidas) |
| `notificaciones` | 1.253 | 11/10 | 5/11 | avisos |
| `leads_papelera` | 373 | 30/10 | 30/10 | foto de lo borrado (un solo borrado masivo, negocio 1) |
| `landing_visits`, `vsl_events` | 19.898, 124.432 | 15/6 | 5/11 | visitas a las landings de los clientes |
| `curso_accesos`, `service_incidents` | 1, 22 | | | `service_incidents` es de Meta, no de la app |

**Entradas (`usuarios`, 23 usuarios en 17 negocios).** `ultimo_login` no es sólo el login: `lib/ultimo-uso.ts` lo marca desde `/api/auth/me` cada 12 horas como mucho, y nunca a un suspendido ni a quien no tiene fecha. Entraron en 7 días: 9 usuarios; en 30 días: 14; nunca: 7 (5 de ellos están en `invitado`, 2 suspendidos o recién creados). `sesiones_desde` es **null en los 23**: es un corte de sesiones al cambiar clave, no actividad. Por negocio (7d / 30d / nunca): 1: 1/1/0 · 9: 1/1/0 · 10: 0/2/0 · 11: 1/1/0 · 13: 1/1/0 · 15: 1/1/0 · 17: 1/1/2 de 3 · 19: 1/1/0 · 23: 1/1/1 de 2 · 18, 20, 21, 22: 0/1 · 14: último 2/9 · 5: último 17/7 · 3: 0/0, ninguno entró · 900001: nunca. El negocio 4 no tiene usuarios.

**Pantallas abiertas o acciones:** no existe tabla de eso. Lo más parecido: `lead_audit` (sólo cambios en leads; 8 correos distintos en total, 7 en los últimos 7 días), `credenciales_auditoria`, `api_llamadas` y `anthropic_usage`. Para los demás módulos (CRM abierto, dashboard, flujos editados, borrados fuera de leads) no hay rastro. El pedido del 13/10 de un registro de acciones sigue sin hacerse.

**Señales por negocio, últimos 30 días** (de las tablas con `workspace_id`; mensajes = volumen, incluye automáticos):

| Neg. | Leads nuevos | Msgs WA | Msgs IG | Envíos nutrición | Turnos MaKo (grupo) | Chat dashboard | Landings | Hojas dashboard (total) | Llamadas IA | Tickets |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 12 | 5.830 | 0 | 487 | 114 | 32 | 3 | 4 | 3.170 | 3 |
| 3 | 138 | 47 | 0 | 239 | 0 | 302 | 10 | 2 | 705 | 1 |
| 9 | 230 | 2.578 | 15 | 0 | 38 | 2 | 52 | 2 | 1.468 | 9 |
| 10 | 226 | 2.593 | 116 | 96 | 22 | 12 | 3 | 1 | 87 | 15 |
| 11 | 444 | 11.119 | 50 | 47 | 60 | 146 | 2 | 2 | 549 | 14 |
| 13 | 50 | 2.201 | 24 | 52 | 219 | 0 | 1 | 4 | 644 | 7 |
| 15 | 44 | 0 | 0 | 39 | 101 | 0 | 0 | 1 | 99 | 2 |
| 17 | 1 | 0 | 0 | 0 | 4 | 0 | 0 | 0 | 15 | 2 |
| 18 | 0 | 346 | 0 | 0 | 28 | 1 | 0 | 0 | 35 | 0 |
| 19 | 117 | 13.907 | 0 | 12 | 40 | 6 | 0 | 0 | 61 | 1 |
| 20 | 3 | 3.428 | 0 | 3 | 15 | 47 | 0 | 0 | 35 | 0 |
| 21 | 0 | 6.347 | 0 | 0 | 1 | 0 | 1 | 0 | 28 | 0 |
| 22 | 0 | 1.481 | 0 | 0 | 4 | 0 | 0 | 0 | 8 | 0 |
| 23 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 3 | 8 | 1 |
| 14 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 25 | 0 |
| 4, 900001 | 0, 6 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 12, 0 | 0 |

Por tab no hay forma de medir «qué usa»: lo que se puede inferir es qué llena datos. Flujos activos: el almacén `mako.plantillas.store` sólo existe en los negocios 1, 4 y 13 (3, 1 y 1 flujos activos); el resto hereda de la base y esa cuenta no sirve. Informes de General: 1 por negocio en 9 negocios. «Creaciones» (`creaciones`, `creacion_usos`, `creacion_estrellas`): 0 filas. Reportes enviados: no hay tabla (no medí los crons `reporte-*`).

## 4. Errores

**Cómo llega un error (del código).**
- Navegador: `app/error.tsx` y `global-error.tsx`, el reportador de la ventana (`ReportarErrores`) y `CentinelaArranque` (detecta la pantalla propia de Next y recarga una vez) mandan a `POST /api/errores`.
- Servidor: `instrumentation.ts` → `onRequestError`.
- Cron: **sólo `cron/montaje`** llama `registrarError`; el resto de los crons escribe en logs de Vercel, que no se pueden ver desde acá.
- MaKo: `mako-doer-in` y `mako-turno-app` mandan los fallos del chat.
- Todo pasa por `lib/errores-app.ts`: se agrupa por huella, la primera vez abre un ticket de bug de canal `sistema`, y el vigía de grupos (cada 15 min) lo relee.

**Qué se pierde (del código):**
- `/api/errores` exige sesión y mismo origen: un error antes de entrar, en una landing o en una página pública no llega. No medí si la app nativa pasa el chequeo de origen.
- El ruido se descarta sin rastro (extensiones, red caída, chunk de un deploy viejo, 429/503/timeouts de IA).
- Los de configuración del cliente se descartan; tope de 10 huellas nuevas por persona y día; payload de 8 KB.
- Un error de servidor que llega al navegador con sólo el digest se deja al servidor.
- La fila guarda `veces`, primera y última vez, no cada aparición: **no hay línea de tiempo**, no sirve para «cuándo se cae».
- No hay ping externo ni ruta de salud, ni Sentry (no hay dependencia en el repo): si Vercel o la base se caen, nadie lo registra. Lo más cercano es el vigía de grupos, que mira conversaciones de MaKo.

**Medido.** 8 huellas, 11 apariciones, del 18/10 al 4/11: navegador 6 huellas y 9 apariciones, mako 2 y 2, **servidor 0 en 19 días** (no sé si es que no hubo o que no llega). Las 8 tienen ticket: 7 resueltos, 1 en curso. Las más repetidas: «La pantalla “Plan” se volvió a dibujar sola» 3 (4/11), «“General” se rompió» 2, «“CRM” se rompió» en 3 huellas de 1, «MaKo no pudo contestarte» 2 huellas de 1. Hay 6 tickets de bug de canal `sistema` (de 55 en total). Los textos de error no se muestran acá porque su `ejemplo` y `afectados` llevan correos.

## 5. Estado de alta

**De dónde sale (código y base).**
- Persona: `usuarios.estado` (`invitado`, `activo`, `suspendido`), `invitacion_enviada_at`, `ultimo_login`, `rol_ws`.
- Negocio: `workspaces.estado` (`activo`, `pausado`), `workspaces.capa` (el plan), onboarding en `app_settings` `onboarding.state` (`status`), agencia en `agencia_clientes.estado`, plan a mano en `plan.a_mano`, pagos en `cobros.alta_estado` (`pendiente`, `hecha`, `ya_tenia_cuenta`, `error`).

**Medido.** Usuarios: 15 activo, 5 invitado, 3 suspendido (15, 19 y 22, a propósito). Negocios: 17 activo (1 agencia, 15 completo, 1 superadmin) y 1 pausado (capa `pm`). Agencia 13: 7 clientes aprobados y 1 revocado (negocio 3). Onboarding: 16 de 17 en `done` (el 5, pausado, `pending`; el demo 900001 sin fila). `pedidos_ingreso` y `bajas_cuenta`: 0 filas. `plan.a_mano`: 0 filas.

**Qué miente o falta (deducido):**
- **El plan no dice qué paga cada uno.** 15 negocios tienen capa `completo`, sin importar si pagan 97, 146 o nada. El precio sólo existe en `pagos`, y el plan comprado sólo en los 2 `cobros` pendientes.
- **El onboarding casi no distingue:** 16 de 17 en `done`, incluidos negocios con usuarios que nunca entraron (17 tiene 2 de 3 sin entrar). `onboardingHecho` en la tab casi nunca da «Sin terminar».
- **«Invitado» mezcla dos casos:** el usuario 4 (negocio 3) nunca recibió la invitación; los otros 4 la recibieron y no entraron. La grilla ya los separa, la tab Customers no.
- **El negocio 3 está «activo»** con sus 2 usuarios invitados y sin entrar, pero con 138 leads y 862 filas de auditoría en 30 días: es el negocio de pruebas (autores de arnés). El 4 no tiene usuarios. El 900001 (demo, creado el 4/11) cuenta como cliente.
- **Suspender es de la persona, no del negocio:** el negocio 22 sigue `activo` y tuvo 645 mensajes de WhatsApp en 7 días; el 18, 119. La suspensión corta el ingreso, no la actividad automática.
- **Los clientes de agencia (15, 17, 18, 19, 20, 22, 23)** aparecen con «Lo opera su agencia» porque la agencia entra con su sesión y no queda marca.
- El negocio 5 (pausado) tiene capa `pm`, distinta de las demás; no verifiqué si todavía es un plan vendible.

## 6. Lo que sorprendió

1. **Octubre sí se ve en la tab** (barra de 340), pero el número grande dice US$ 0. No es «no lee pagos»: es que el titular usa el mes en curso y noviembre no está cargado.
2. **Los dos `cobros` ni siquiera entrarían al MRR aunque se pagaran:** `cobrosDeLugares` filtra por `alta_ws`/`cliente_ws` no nulos, y los links de venta nacen con ambos en null.
3. **16 checkouts de Stripe vencieron sin pagar** desde el 13/10 (el último hoy). Es la única señal de intención de compra que hay.
4. **`replay_sesiones` son las landings de los clientes, no la app.** `/privacidad` dice «ni grabadores de sesión» y habla de la app; existe además un cron `replay-purga` que no revisé contra la sección de retención. Decisión legal de Martín.
5. **`/privacidad` ya dice que queda registrado quién movió qué y que el correo queda de autor,** y que el administrador del espacio puede verlo. Cubre `lead_audit`; no cubre un registro de pantallas abiertas ni de todas las acciones. Dice «hoy no hay borrado automático».
6. **El único rastro de actividad humana es `lead_audit`:** 8 correos distintos en total. Quien sólo mira pantallas, o edita fuera de leads, no deja nada.
7. **`agente_sesiones` y la pestaña Agents están vacías** (0 filas): nadie activó el plugin.
8. **Un comentario de `app/admin/dev/areas.ts` está viejo:** dice que no existe tabla de errores ni `onRequestError`; ambos existen desde el 17/10.
9. **Los tickets son 55, no 51** (catálogo viejo); `anthropic_usage` y `lead_audit` crecen sin retención; `lead_audit` tuvo 12.970 filas en octubre contra 849 en septiembre.
10. **Última migración en main: 0394.**

No medí: pantallas ni acciones de usuario (no existen), errores de crons y de Vercel (logs fuera de la base), caídas reales, uso por tab, agencia entrando a sus clientes, el estado real de `plan` pagado por cada negocio fuera de `pagos`.
