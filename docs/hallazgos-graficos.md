# Hallazgos — Graphics › Mis gráficos

El editor de informes que cada persona arma (copiado de Looker Studio) y lo que se aprendió al
construirlo. Lo que se hizo está en el commit; acá va lo que hay que saber **antes** de tocarlo.

## Cómo está armado, en una tabla

| Pieza | Vive en | Qué decide |
|---|---|---|
| El catálogo | `lib/graficos-catalogo.ts` | Tipos de gráfico, fuentes, dimensiones y métricas. Sin `server-only`: lo leen la pantalla, el server y los tests |
| El agregador | `lib/graficos-agregar.ts` | De filas a lo que se dibuja: grupos, razones, «Otros», relleno del tiempo |
| El lector | `lib/graficos-datos.ts` | Lee cada fuente de la base (paginado, con el scope del workspace) |
| El informe de cada persona | `lib/graficos-tablero.ts` | Un setting `graficos.tablero.<usuario>` en el workspace de la pestaña |
| La ruta | `app/api/graficos/route.ts` | `datos` y `guardar`; la misma puerta que la página |
| La pantalla | `app/graficos/` | El editor estilo Looker y el que dibuja cada gráfico |

## El informe se guarda por PERSONA y por workspace, no por workspace

**Vive en:** `lib/graficos-tablero.ts`

El super admin mira a cada cliente con `?ws=N` y la agencia ws13 mira a sus clientes. Guardado por
workspace, armar un gráfico mirando a otro le cambiaba la vista al dueño de esa cuenta (es el
mismo agujero de `docs/hallazgos-ui.md` → «Una preferencia de vista guardada por workspace la pisa
quien mira con ?ws=»). La clave lleva el `sub` de la sesión y vive en `app_settings` del workspace
de la pestaña, que no hereda entre workspaces. Sin migración.

⚠️ **«No pude leer» no es «no armó ninguno».** Con la lectura caída se dibuja el informe inicial y
NO se deja guardar (el botón Editar se apaga): el primer cambio pisaría el informe real.

⚠️ **Verificar la pantalla ESCRIBE.** El guardado es automático, así que recorrer el editor con
`dev-login` deja un `graficos.tablero.dev` en el workspace donde se probó. Se borra al terminar
(el 11/10 se borró dos veces del ws1).

## La pauta de Meta termina AYER, no hoy

**Vive en:** `lib/graficos-datos.ts` (`hastaDeFuente`)

Síntoma: toda serie de gasto terminaba en un desplome a cero el último día. No es un bug del
gráfico: la pauta llega por cron y el día en curso todavía no está. Es el mismo motivo del techo
de Tendencias en `lib/queries.ts`. La fuente Meta se lee hasta ayer; las otras dos, hasta hoy.

## Una razón se calcula sobre lo SUMADO, y una torta no acepta razones

**Vive en:** `lib/graficos-agregar.ts` · `metricasPara` en `lib/graficos-catalogo.ts`

- El CTR de una campaña es sus clics ÷ sus impresiones, no el promedio de los CTR diarios. Toda
  métrica con `razon` se calcula al final, sobre las bases del grupo; «Otros» suma las bases y
  recalcula, igual que cualquier grupo.
- Una torta parte un total: un costo por lead en porciones no suma 100% de nada. El catálogo no se
  la ofrece y el saneo la corrige.
- El tiempo se RELLENA: un día sin filas es un cero dibujado. Una línea que saltea el martes se lee
  como si el lunes y el miércoles fueran seguidos.

## «Cerraron» en el CRM es una cuarta definición de cierre

**Vive en:** `filasLeads` en `lib/graficos-datos.ts`

La app ya contaba el cierre de tres formas (`docs/hallazgos-crm.md` y la tarjeta #323: cohortes por
el mes de la reunión con `cerro`, Tendencias por `fecha_cierre` con `estado_lead = 'ganado'`, y el
objetivo de /general). Mis gráficos cuenta `cerro || estado_lead === 'ganado'`, por la fecha que
la persona elija en «Dimensión del período». No es un error, pero un número de Mis gráficos y uno
de /comercial pueden no coincidir por eso: antes de «arreglar» uno, mirá cuál de las cuatro es.

## Lo que se midió con datos reales (ws1, 10/10, últimos 30 días)

Gasto US$1.164, 85 leads, costo por agenda US$83,18 (las agendas que Meta atribuye), tres campañas
con 70/20/10% del gasto. En ws11, «Leticia Hernández» figura **perdida con un pago cobrado** de
US$40: por eso no suma a lo ganado de Leila (tarjeta #705, pospuesta).

## Por qué react-grid-layout y no otro

Se buscó un constructor de tableros ya hecho para no escribirlo (pedido de Martín). No hay uno
embebible en Next con licencia libre: Metabase y Grafana son AGPL y aplicaciones enteras, Superset
es Python. Lo que sí sirve son las piezas: `react-grid-layout` (MIT, mantenida) para arrastrar y
agrandar, y `recharts`, que ya estaba. Se fijó la **2.2.4** y no la 2.3.0, que tenía 5 días.

## Lo que quedó sin hacer

- **Filtros, campos calculados y combinar fuentes** («Blend»): no se copiaron de Looker a propósito.
- **Controles sobre la página** (el período como un componente): el período lo pone el filtro de
  arriba de Graphics.
- **El tema oscuro**: el CSS del editor tiene los valores de Looker limitados a `.lk` (como el de
  GitHub en `/api-mako`); en oscuro se ve como una isla clara.
- **`app/ads-manager/AdsManagerView.tsx`** tira un rango que termina después de hoy, igual que
  hacían `/marketing` y `/comercial` (`docs/hallazgos-ads.md`).

*11/10/2026, chat «Graphics».*
