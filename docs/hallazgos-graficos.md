# Hallazgos — el Dashboard (el editor de informes)

La tab Dashboard es un editor de informes copiado de Looker Studio: hojas, 41 tipos de gráfico,
estilo editable, control de período y los 24 conjuntos de datos de MaKo. **El editor es de Looker; los
gráficos son de MaKo** (Martín, 11/10: «que los graficos editables se parezcan más a esos» — los de
las tabs viejas): tarjetas con los tokens de la app, la KPI de 44 px con su rótulo en mono, el embudo
de trapecios. El informe inicial es la réplica de las tabs viejas de Marketing y Comercial. Lo que se hizo está en el
commit; acá va lo que hay que saber **antes** de tocarlo.

## Cómo está armado, en una tabla

| Pieza | Vive en | Qué decide |
|---|---|---|
| El catálogo | `lib/graficos-catalogo.ts` | Conjuntos de datos, tipos, estilo, hojas, período e informe inicial. Sin `server-only`: lo leen la pantalla, el server y los tests |
| El agregador | `lib/graficos-agregar.ts` | De filas a lo que se dibuja: grupos, razones, distintos, «Otros», desglose, relleno del tiempo |
| Los lectores | `lib/graficos-datos.ts` (`LECTORES`) | Uno por conjunto: lee la tabla, paginado y con el workspace explícito |
| El informe de cada persona | `lib/graficos-tablero.ts` | Un setting `graficos.tablero.<usuario>` en el workspace de la pestaña |
| La ruta | `app/api/graficos/route.ts` | `datos` (con el período de cada gráfico) y `guardar`; la misma puerta que la página |
| La pantalla | `app/dashboard/` | `EditorInforme.tsx` (el editor) y `Grafico.tsx` (cómo se dibuja cada tipo) |
| Las rutas viejas | `app/marketing/page.tsx`, `app/comercial/page.tsx`, `app/graficos/page.tsx` | Redirigen a `/dashboard?hoja=…`, con `rutaConWs` |

## El informe se guarda por PERSONA y por workspace, no por workspace

**Vive en:** `lib/graficos-tablero.ts`

El super admin mira a cada cliente con `?ws=N` y la agencia ws13 mira a sus clientes. Guardado por
workspace, armar un gráfico mirando a otro le cambiaba la vista al dueño de esa cuenta (el mismo
agujero de `docs/hallazgos-ui.md` → «Una preferencia de vista guardada por workspace la pisa quien
mira con ?ws=»). La clave lleva el `sub` de la sesión y vive en `app_settings` del workspace de la
pestaña, que no hereda entre workspaces. Sin migración.

⚠️ **«No pude leer» no es «no armó ninguno».** Con la lectura caída se dibuja el informe inicial y NO
se deja guardar (el botón Editar se apaga): el primer cambio pisaría el informe real.

⚠️ **Verificar la pantalla ESCRIBE, y la limpieza se acota al usuario de PRUEBA, nunca al prefijo.**
El guardado es automático: recorrer el editor con `dev-login` deja un `graficos.tablero.dev`. El
11/10 la limpieza borraba `graficos.tablero.%` de las últimas horas y se llevó también
`graficos.tablero.2` — el informe de Mauricio, que lo había abierto en producción 40 minutos antes.
Pesaba 1.652 bytes, lo mismo que el inicial sin tocar, así que casi seguro no tenía cambios suyos;
pero no hay forma de saberlo. La limpieza borra sólo `graficos.tablero.dev`.

## Mirar el Dashboard lo GUARDABA, y una copia guardada no recibe las mejoras del inicial

**Vive en:** `alMoverGrilla` en `app/dashboard/EditorInforme.tsx`

react-grid-layout avisa `onLayoutChange` también al MONTAR, cuando compacta lo que le llegó. Ese aviso
cambiaba el estado, y el autoguardado (700 ms) lo escribía: **abrir la tab, sin tocar nada, congelaba
una copia del informe inicial**. Así reapareció `graficos.tablero.2` (Mauricio) a las 01:59 del 11/10,
con los 20 gráficos del inicial de entonces sin un cambio suyo. El daño no se ve: el informe se dibuja
igual. Lo que se pierde es que, de ahí en más, cambiar `tableroInicial()` no le llega a esa persona.

La grilla ahora sólo escribe mientras se edita (`if (!editando) return`, con guard en
`tests/graficos.test.ts`). Medido en el navegador: mirar las dos hojas no deja fila; arrastrar una
tarjeta, sí. ⚠️ **Al cambiar el informe inicial, mirá quién ya tiene uno guardado**
(`app_settings` con `key like 'graficos.tablero.%'`): a esa gente no le llega. El 11/10 había uno,
el de Mauricio, igual al inicial viejo; se reemplazó por la réplica y se releyó con `sanearTablero`.

## Un informe del v1 se migra a UNA hoja

**Vive en:** `sanearTablero` en `lib/graficos-catalogo.ts`

El v1 («Mis gráficos», 10/10) guardaba `{ graficos: [] }`; el v2 guarda `{ hojas: [{ componentes }] }`.
Un v1 guardado se lee como una sola «Página 1», sin las hojas Marketing y Comercial del informe nuevo.
Al 11/10 no quedó ninguno guardado (ver arriba), así que nadie lo ve; si aparece, «Restablecer» trae
el informe inicial.

## La pauta de Meta (y el resumen del negocio) terminan AYER

**Vive en:** `hastaDeFuente` en `lib/graficos-datos.ts`

Toda serie de gasto terminaba en un desplome a cero el último día: la pauta llega por cron y el día en
curso no está. El resumen del negocio cruza la pauta con el CRM y corta igual, porque con el gasto de
hoy en cero el CAC de hoy saldría regalado.

## Una razón se calcula sobre lo SUMADO; los distintos se cuentan en el grupo

**Vive en:** `lib/graficos-agregar.ts`

- El CTR de una campaña es sus clics ÷ sus impresiones, no el promedio de los CTR diarios. «Otros»
  suma las bases y recalcula, igual que cualquier grupo.
- Las personas de una semana no son la suma de las personas de cada día: una métrica `distinto`
  guarda el conjunto de claves por grupo (`Fila.u`) y cuenta su tamaño.
- Lo que sólo se suma (circular, rectángulos, sankey, embudos, al 100%) no acepta razones: un costo
  por lead en porciones no suma 100% de nada.
- El tiempo se RELLENA: un día sin filas es un cero dibujado.
- El DESGLOSE arma un cruce sobre la PRIMERA métrica, con hasta 8 columnas y el resto en «Otros».

## «Cerraron» es una cuarta definición de cierre, y excluye los «sin cobro»

**Vive en:** `gano` en `lib/graficos-datos.ts`

La app ya contaba el cierre de tres formas (cohortes por el mes de la reunión con `cerro`, Tendencias
por `fecha_cierre` con `estado_lead = 'ganado'`, y el objetivo de /general). El Dashboard cuenta
`cerro || estado_lead === 'ganado'`, menos `venta_tipo = 'sin_cobro'` (los becados), por la fecha que
elija la persona. El guard de `tests/venta-sin-cobro.test.ts` no lo ve —busca `.select('…monto_cierre_usd…')`
literal y acá la lista de columnas es una constante—, así que la exclusión se puso a mano. Antes de
«arreglar» un número que no coincide con /comercial, mirá cuál de las cuatro definiciones es.

## Los 24 conjuntos de datos: qué tabla y qué cuidar

Medido el 11/10 contra la base (`information_schema` + filas por workspace). 21 tienen datos en el ws1.

| Área | Conjuntos | Tablas |
|---|---|---|
| Negocio | Resumen del negocio | `marketing_metrics_daily` + `leads` + `pagos` |
| Marketing | Anuncios, presupuestos, visitas, VSL, grabaciones, creativos | `marketing_metrics_daily`, `adset_budget_daily`, `landing_visits`, `vsl_events`, `replay_sesiones`, `script_analyses` |
| CRM y ventas | Leads, cambios, formularios, pagos, llamadas | `leads`, `lead_audit`, `lead_respuestas`, `pagos`, `closing_analyses` |
| Comunicación | WhatsApp, conversaciones con MaKo | `wa_mensajes`, `mako_doer_conv` |
| Automations | Personas, envíos | `nutricion_inscripciones`, `nutricion_envios` |
| Plan | Tareas | `plan_tareas` o `experimento_tareas`, según `tableroActual()` |
| Customer Success | Entrega, avance en cursos | `cliente_entrega`, `curso_progreso` |
| Second Brain | Conocimiento, archivero | `mako_knowledge`, `archivero_files` |
| Onboarding | Pasos | `app_settings` (`onboarding.tab.<tab>`) |
| IA y contenido | Uso de IA, Flow | `anthropic_usage`, `flow_trabajos` |

- **Toda lectura lleva el workspace EXPLÍCITO** (`eq workspace_id`) además de `getTenantDb()`: varias de
  estas tablas no están en TENANT_TABLES y para ellas el cliente de tenant es passthrough.
- **El contenido de una conversación no se lee nunca** (WhatsApp, MaKo): sólo se cuentan filas.
- **`adset_budget_daily.daily_budget_mxn` está en la moneda de la cuenta** y casi siempre en null (las
  campañas con presupuesto a nivel campaña): el presupuesto sale en cero aunque haya gasto.
- **El VSL del ws1 son 48 mil eventos en 30 días**: un gráfico de esa fuente tarda unos segundos (48
  páginas de 1000). Con «Todo» son 78 mil. Si molesta, la salida es una vista agregada por día.
- **Un id con guion bajo no es un id**: el saneo pide `[a-z0-9-]` y reemplaza el resto, así que la
  respuesta vuelve con otro id. Le pasó a la prueba de las 24 fuentes, no al editor (que acuña los suyos).

## La réplica de las tabs viejas: qué es igual y qué no

**Vive en:** `tableroInicial` en `lib/graficos-catalogo.ts`; el dibujo, en `app/dashboard/Grafico.tsx`

Los bloques están en el orden y el lugar de antes (KPI estrella, Salud del Funnel con sus cuatro de
eficiencia, Tendencias; Revenue, A cobrar, Tendencia mensual, Salud del Funnel comercial, SCL, cohortes).
Para que los números fueran los mismos hubo que sumar métricas, y cada una se calcula como la calculaba
la pantalla vieja — no como sonaría lógico:

- **Vistas del VSL = YouTube (el video marcado `vsl` + el VSL de prueba) + los plays de Panda**, de
  `marketing_metrics_daily`, igual que `lib/queries.ts`. Contar los `play` de `vsl_events` da otro número.
- **El SCL (ciclo de venta) va de `fecha_agenda` a `fecha_primer_pago`**, no de la reunión al cierre
  (`_getSCL` en `lib/queries.ts`). Se promedia sobre los que tienen las dos fechas (`con_ciclo`): dividir
  por todos los cierres lo achica con los que nunca tuvieron reunión.
- **No-show = agendó y no asistió.**
- **El chip «↑ 1,3×»** (`estilo.comparar`) lee el período ANTERIOR del mismo largo, que termina el día
  antes (`periodoAnterior`, en `lib/graficos-agregar.ts` para que tenga test). Es una lectura más por
  gráfico que lo pide.
- **El tope de la tabla pasó de 6 a 8 métricas**: las cohortes tienen ocho columnas y el saneo, en
  silencio, tiraba las dos últimas. El de componentes por página, de 40 a 50: con 41 tipos no entraba
  uno de cada uno.
- **Una tarjeta de número lleva SIEMPRE su filete** (gris si no se eligió color) y el número toma el
  color del filete sólo cuando es mayor que cero: un «US$0» no va en verde, como antes.
- **El blanco de fábrica (`#ffffff`) se pinta como `var(--surface)`**, y ejes, grilla y tooltips usan
  tokens: las tarjetas se dan vuelta en el tema oscuro. El relleno del embudo es claro en los dos temas,
  así que su tinta es fija.

## Por qué react-grid-layout y no otro

Se buscó un constructor de tableros ya hecho. No hay uno embebible en Next con licencia libre:
Metabase y Grafana son AGPL y aplicaciones enteras, Superset es Python. Lo que sí sirve son las piezas:
`react-grid-layout` (MIT) para arrastrar y agrandar, y `recharts`, que ya estaba. Se fijó la **2.2.4**;
la 2.3.0 tenía 5 días.

## Lo que quedó sin hacer

- **Lo que la réplica no pudo copiar:** «Audiencia y alcance» (plataformas y el mapa de México: se
  leía EN VIVO de la API de Meta, no está en la base — en su lugar quedó la tabla de anuncios), el
  desglose clickeable de cada número hasta el nombre de los leads, el chat con MaKo por gráfico, los
  anuncios ganadores con su veredicto, el MRR, la barra cobrado/pendiente, el selector de métricas de
  Tendencias y el «aún sin datos» (ahora sale «—» o «0x»). Las cohortes y el Outstanding sí volvieron.
  El código está en el historial de git (`app/marketing/page.tsx` y `app/comercial/page.tsx` antes del
  11/10/2026).
- **El onboarding de la tab:** /marketing mostraba un panel de activación sin Meta conectado
  (`tabActivacion('marketing')`). El Dashboard no lo muestra: con el CRM solo ya hay qué ver.
- **Mapas, cronología por fechas propias y velas**: no hay datos geográficos ni de rango por fila.
- **Filtros, campos calculados y combinar fuentes**: no se copiaron de Looker a propósito.
- **El tema oscuro del CROMO**: la barra, los paneles y la galería tienen los valores de Looker limitados
  a `.lk` (como el de GitHub en `/api-mako`); en oscuro se ven como una isla clara. Las tarjetas sí se dan vuelta.
- **`app/ads-manager/AdsManagerView.tsx`** tira un rango que termina después de hoy (`docs/hallazgos-ads.md`).

*10-11/10/2026, chat «Graphics». La réplica y el diseño de MaKo, 11/10 de madrugada.*
