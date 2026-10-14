# Autopilot del Ads Manager — diseño (punto 18 del feedback del 13/10/2026)

> Pedido de Martín, textual: «Quiero implementar por completo la IA que te maneja Ads Manager por
> completo, toma desiciones, prende o apaga ads, sube presupuesto, baja... Crea variaciones de Hooks
> gracias a la generación de vídeo y publica sola... Cuando le falta material te pide que te grabes y
> te da el guion listo, etc... Quiero que sea todo automático y que se le puedan configurar
> parámetros...». Validado el 13/10 («implementalo completo y de punta a punta»).
>
> Encuadre ya decidido (relayado por «Estrategia 3 CUENTAS»): parámetros del cliente; dos modos —
> «propone y una persona confirma» (el default) y «automático» (lo prende el cliente, actúa sola
> DENTRO de sus topes)—; cada decisión en un historial con su porqué y deshacer; `validate_only`
> antes de escribir.
>
> El relevamiento que sostiene cada decisión de abajo (6 lectores, 14/10/2026) está cosechado en
> `docs/hallazgos-ads.md` → «El Autopilot».

## Nombre

**Autopilot** (los nombres de producto van en inglés; el copy, en español neutro con «tú»).

## Qué decide y con qué

**El veredicto es CÓDIGO, no un modelo.** Reglas deterministas con los umbrales del cliente
(`lib/ads-autopilot-reglas.ts`, puro, con test). Ningún monto ni id pasa por un LLM. «La IA» que ve
el cliente es MaKo aplicando su criterio con sus parámetros; el porqué lo arma el código con los
números que usó. Razón: una decisión de plata hecha con un modelo peor «contesta mal y se ve igual
que una bien hecha» (docs/hallazgos-ia.md), y `fallback: []` no impide caer a flash-lite.

**Datos** (todo por workspace, adentro de `runWithWorkspace(ws)`):

- **Rendimiento:** `marketing_metrics_daily`, una fila por anuncio por día, cerrada a T+1 (el cron
  `meta-daily` trae AYER en Tijuana). Ventana: los últimos `ventanaDias` días CERRADOS (hasta ayer).
  No hay datos de hoy: el Autopilot decide una vez por día, con el día de ayer cerrado.
- **Frescura:** si la última fecha de Meta del workspace no es ayer (`getDataSources`), NO decide
  (motivo `datos_viejos`). Una tabla vacía de ayer no es «gastó 0».
- **Gasto en USD:** con `aUsd` del conversor (`lib/moneda-meta.ts`), que devuelve `null` sin tasa.
  Sin tasa (moneda distinta de USD/MXN), NO decide (motivo `moneda_sin_tasa`). Nunca `aUsdNum`.
- **Resultados por anuncio:** `max(leads de Meta, leads del CRM atribuidos al anuncio en la
  ventana)`. Los del CRM salen de `adIdDeLead` (`lib/atribucion-url.ts`: `meta_ad_id`, después
  `utm_content`). El `max` y no la suma: un lead de formulario está en los dos lados. Sin esto, la
  regla de «gasta sin resultados» apagaría los anuncios de una landing (9 de 114 agendados del ws1
  tienen `meta_ad_id`).
- **Estado y presupuesto ACTUALES:** el árbol EN VIVO, sin caché (`getMetaHealthVivo`, la misma
  lectura de `getMetaHealth` sin `cachedRead`). Si viene `parcial: true`, NO decide. El árbol
  cacheado puede tener cualquier edad y `metaWrite` no lo invalida.

## Las reglas (en este orden, cortando en `maxPorCorrida`)

| # | Qué | Cuándo | Qué propone |
|---|---|---|---|
| R1 | Pausar un anuncio que gasta sin resultados | anuncio con `effectiveStatus` ACTIVE · gasto ≥ `gastoMinUsd` · 0 resultados · ≥ `diasMin` días con gasto en la ventana | `status: PAUSED` del anuncio |
| R2 | Pausar un anuncio caro | ACTIVE · ≥ 1 resultado · `cplMaxUsd` puesto · CPL > `cplMaxUsd` · gasto ≥ 2 × `cplMaxUsd` | `status: PAUSED` del anuncio |
| R3 | Bajar el presupuesto de lo que rinde mal | el DUEÑO del presupuesto (la campaña si `budgetLevel === 'campaign'`, si no el conjunto) ACTIVE, con presupuesto DIARIO (nunca total) · `cplMaxUsd` puesto · CPL de sus anuncios > `cplMaxUsd` · gasto ≥ `gastoMinUsd` | diario × (1 − `pasoPct`), nunca menos de `presupuestoMinUsd` |
| R4 | Subir el presupuesto de lo que rinde bien | dueño del presupuesto ACTIVE, diario · aprendizaje no `LEARNING` · ≥ `leadsMinEscalar` resultados · `cplObjetivoUsd` puesto · CPL ≤ `cplObjetivoUsd` · `topeDiarioUsd` puesto | diario × (1 + `pasoPct`), sin pasar el tope (abajo) |
| R5 | Pedir material nuevo | un conjunto ACTIVE que, con lo que se propone pausar, queda con < 2 anuncios activos | no escribe en Meta: pide grabarse, con un guion listo si hay (abajo) |

Y para todas:

- **Respiro:** ninguna regla toca una entidad con una decisión `aplicada` en las últimas
  `respiroHoras` (default 72): cada cambio devuelve a Meta a aprender. Tampoco si ya tiene una
  `propuesta` viva (índice único, abajo).
- **Tope de gasto por día** (`topeDiarioUsd`): la suma de los presupuestos DIARIOS de lo que está
  activo, en USD, más el aumento propuesto, no puede pasarlo. Sin tope puesto, R4 no corre. Es un
  techo de lo que se PRESUPUESTA, no de lo gastado hoy (eso no se puede leer de la base).
- **Topes del código, que el cliente no puede aflojar:** `pasoPct` entre 5 y 50; nunca más de ×10
  ni menos de ÷10 respecto del actual (el ×10 de `ads.run.ts`); nunca un diario sobre un total.
- **Lo que NO toca nunca:** lugares, público, creativos, ni borra nada. Activar sólo como deshacer
  de una pausa propia.

## Los dos modos (y apagado)

`modo: 'apagado' | 'propone' | 'automatico'`, default **apagado** para TODOS (sin backfill: sin
clave, apagado). Prenderlo es una decisión del cliente.

- **propone:** cada decisión queda `propuesta`, vence a las 24 h (`vence_at`), y se confirma en la
  pantalla (o por la API de MaKo con confirmación `pantalla`). Push a los admins.
- **automatico:** las decisiones cuya acción esté en `accionesAuto` (default `['pausar']`) se aplican
  solas; las demás quedan como propuesta. R5 nunca escribe.

## Aplicar (una sola función para los dos modos y para confirmar)

`aplicarDecision(id, { ws, actor })` en `lib/ads-autopilot.ts`:

1. **Reclama** la fila (`estado` `propuesta` → `aplicando`, compare-and-set). Un doble clic aplica una vez.
2. **Relee EN VIVO** la entidad (status, presupuesto, `account_id`) con el token del ws.
3. **Re-chequea:** que sea de la cuenta (`esDeLaCuenta`); que el valor actual sea el `antes` de la
   decisión (si cambió, `vencida`: el porqué ya no vale); topes y respiro de nuevo.
4. **`validate_only`:** el mismo POST con `execution_options=["validate_only"]` (`metaWrite` con
   `validarSolo: true`). Si Meta lo rechaza, NO se escribe (`error`). ⚠️ Un OK de `validate_only`
   sobre una ACTUALIZACIÓN no está medido: sirve para frenar, no prueba nada (AGENTS.md: un
   validador se prueba con una entrada mala).
5. **Escribe** con `metaWrite(body, ws)`. Sin reintento (lo que gasta plata no se reintenta).
6. **Anota** `despues`, `aplicada_at`, `validado`, el actor y el resultado. Si falla, `error` con el
   mensaje: nunca vuelve a `propuesta`.

## Deshacer

`deshacerDecision(id, { ws, actor })`: sólo `aplicada`. Relee en vivo; si el valor actual no es el
`despues`, se niega («cambió desde entonces»). Escribe el `antes` EXACTO de ESA entidad (una pausa
se deshace activando sólo esa entidad, sin cascada: la cascada prende lo que alguien había pausado
a propósito). Deja una fila nueva `deshace_id = id` y marca la original `deshecha`.

## Material: «grábate con este guion» (R5) y las variaciones de hook

- R5 deja una decisión `accion: 'material'` que no escribe en Meta: dice qué conjunto se queda sin
  anuncios y trae un guion listo para grabar si el negocio tiene uno en Ads Writer (estado
  `aprobado`, «listos para grabar»), con link a `/ads-writer`. Si no hay, el link manda a escribir uno.
- **Las variaciones de hook filmadas solas NO se pueden hacer hoy desde el servidor**, y no es una
  decisión: el que filma es el navegador del cliente (extensión + pestaña de Flow abierta), las
  acciones de video exigen sesión, no hay generador de N ganchos, el historial del generador topea
  en 10 planes, y el worker de montaje no está desplegado. Se coordina con «Content Machine»: el
  Autopilot publica como anuncio EN PAUSA lo que ya esté listo en «Mis creativos» cuando ese
  pipeline exista; hasta entonces, R5 pide el material.

## Seguridad e inquilinos

- El cron (`/api/cron/ads-autopilot`, cada hora a los :20) corre con `checkCronAuth`,
  `correrPorWorkspace('meta', …)` (cada ws adentro de `runWithWorkspace`), `maxDuration: 300` y
  `AbortSignal.timeout` en cada fetch. Decide UNA vez por día por workspace (marca
  `ads.autopilot.ultima_corrida` con la fecha del negocio), dentro de su `horario`.
- Lecturas que deciden, ESTRICTAS: `getSettingEstricto`, `zonaDelNegocioEstricta`, `credWsEstricta`.
  Si fallan, no se decide.
- **Una cuenta publicitaria compartida por dos workspaces no se maneja** (el ws3 llegó a tener la
  misma cuenta que el ws1): el cron junta las cuentas de la ronda y saltea las repetidas.
- Si `listarWorkspaces` falla, `correrRonda` corre sólo el ws1 (un cliente): el Autopilot exige
  config propia del ws, así que ahí no hace nada sin la clave.
- Por la API de MaKo, aplicar es `confirmacion: 'pantalla'`, `costo: 'dinero'`, `rolMinimo:
  'admin'`, y **un flujo no puede aplicar decisiones** (el preparar se niega con `canalKey` de
  flujo): la regla es que lo que cuesta plata lo confirma una persona o el modo automático del
  propio cliente, nunca un paso de una automatización.

## Persistencia

- **Parámetros:** `app_settings` clave `ads.autopilot` (JSON), módulo puro
  `lib/ads-autopilot-config.ts` con el molde de `lib/limites-envio.ts` (campo ausente = fábrica,
  fuera de rango se RECHAZA al guardar, nunca se recorta).
- **Decisiones:** tabla `ads_autopilot_decisiones` (migración `0275_ads_autopilot.sql`, ANTES o
  junto con el deploy): `id uuid`, `workspace_id bigint not null` (sin default 1), `nivel`
  (campaign|adset|ad), `entidad_id`, `entidad_nombre`, `accion` (pausar|activar|presupuesto|
  material), `regla` (R1..R5 / deshacer), `antes jsonb`, `despues jsonb`, `porque jsonb` (métricas,
  umbral, ventana desde/hasta), `modo`, `estado` (propuesta|aplicando|aplicada|descartada|vencida|
  deshecha|error), `vence_at`, `validado jsonb`, `error text`, `actor text`, `deshace_id uuid`,
  `created_at`, `aplicada_at`, `deshecha_at`. Índice único parcial (workspace_id, entidad_id) WHERE
  estado = 'propuesta' (una propuesta viva por entidad; se inserta y se ataja el 23505, no se hace
  upsert). RLS + `revoke all from anon, authenticated`. Va en `TENANT_TABLES` (lib/workspace.ts) y
  en `TABLAS_DE_INQUILINO` (lib/tablas-de-inquilino.ts).

## Pantalla

Un botón «Autopilot» en la cabecera del Ads Manager (entre «Nueva campaña» y «⋯»), con un badge
con las propuestas vivas, que abre un `Modal` con `Tabs`: **Decisiones** (propuestas con
«Aplicar» / «Descartar», aplicadas con «Deshacer»; una frase por fila y el porqué desplegable) y
**Ajustes** (el modo, las acciones del automático, los topes, los umbrales y el horario). NO es una
cuarta sub-tab: el ternario de `CampanasBrowser` la trataría como Anuncios.

## Lo que queda afuera, con su archivo

- Filmar variaciones de hook solas: depende del pipeline de video sin sesión (app/video-generator/video-action.ts).
- Gasto de HOY: no hay lectura intradía (app/api/entity-insights/route.ts es por entidad).
- `ads_management` de la app MaKo: en revisión de Meta; el Autopilot escribe sólo donde el token tenga el permiso.
- Los flujos todavía pueden correr `proponer_presupuesto_*` sin tope (lib/api-mako/flujo.ts no mira `costo`): anotado en docs/hallazgos-planes-y-cobro.md; es del núcleo de la API.
