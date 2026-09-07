# Objectives, KPIs y la vista General como FOCUS

**Estado:** IMPLEMENTADO el 06-07/09/2026 (F0 a F4). Este documento es el diseño que
se acordó y se siguió; lo que se aprendió construyéndolo —y lo que quedó sin hacer— vive
en [hallazgos-objectives.md](hallazgos-objectives.md).
**Reemplaza a:** nueve tareas sueltas del board que resultaron ser una sola feature.

---

## El diagnóstico

**`/general` hoy sólo mide resultados. Todo lo que se pidió son acciones.**

Los cuatro bloques de [app/general/page.tsx](../app/general/page.tsx) —hero del objetivo,
resumen del mes, semáforo y pendientes— muestran cierres, cash, agendas, cuotas vencidas,
fatiga de creativo y tasa de cierre. Todos son **consecuencias**: cosas que ya pasaron y
sobre las que hoy no se puede actuar. Las seis reglas del Semáforo (`page.tsx:108-190`)
alertan sobre resultados; **ninguna sobre una acción que se cumple o no día a día**.

Eso es exactamente lo que Mauricio nombró como el hueco de su propia metodología, en
[programa-mauricio.md](programa-mauricio.md):

> *«los objetivos son el puente que no existe para las palancas… las palancas no tienen
> sentido si no las mezclo con los objetivos. Ahí es donde está roto»*

Y es la bajada literal de su pedido de producto más fuerte, del 31/07:

> *«no solamente es la parte del resultado, sino que si Mauricio Bustos no subió con
> evidencia los siete videos a la semana, no va a ocurrir… porque obligas a la gente»*

O sea: a la tab General no le falta un bloque. **Le falta la columna vertebral entera.**

## Las nueve tareas son una

Estaban repartidas en tres proyectos distintos, y por eso ninguna se podía terminar sola.

| # | Tarea | Proyecto | Score |
|---|---|---|---|
| 523 | Foco: la prioridad de la semana con sus 6 campos | Foco | 80 (deadline 28/08, vencido) |
| 165 | El semáforo certifica salud de un negocio del que no sabe nada | General | 63 |
| 219 | Capacidad instalada + meta de facturación | Dashboard | 53 |
| 326 | Tablero operativo de seguimiento diario y semanal | Foco | 42 |
| 285 | Módulo «Acción Semanal / Foco» en el dashboard principal | Foco | 40 |
| 286 | Tracking de objetivos de agendas + alertas por desvío | Dashboard | 37 |
| 319 | Checklist de servicio (ahí se nombra capacidad instalada) | Admin | 32 |
| 680 | Funcionalidad de OBJETIVOS | Plan | 30 |
| 632 / 633 / 634 / 635 | Quarters + OKRs/KPIs + recordatorios + vista por Q | Plan | 23–13 |

## La espina

```
META ANUAL (facturación)
 └─ Q1..Q4                          #632, #634
     └─ OBJECTIVE                   #680, #633   ← el resultado. Se mide, no se hace.
         └─ KPI                     #326, #286   ← lo que lo mueve. Tiene meta,
             │                                      cadencia y umbral.
             └─ TAREAS del plan     ya existe (Perro Guardián)

CAPACIDAD INSTALADA                 #219  ← la restricción: ¿podés entregar lo que vendés?
```

## Los nombres

Regla de la casa: **nombres en inglés, copy en español neutro, y el nombre se entiende solo
sin apodo** (ver la memoria `reglas-de-voz-y-nombres`).

| Concepto | Nombre | Por qué |
|---|---|---|
| El módulo | **Objectives** | Ya es el nombre que usa el documento de rediseño en la #523 |
| Lo que cuelga de un objetivo | **KPI** | Es la palabra de la propia tarea #633. Universal, en inglés, cero jerga interna |
| La pantalla de entrada | **General** (key `general`) | La key es contrato con la base; el label puede cambiar después |

⚠️ **«Palanca» NO se usa en MaKo.** Es vocabulario de Mauricio y de su metodología 4DX.
Adentro del producto la cosa se llama KPI. Decisión del dueño, 06/09/2026.

Y el matiz LAG/LEAD **no se nombra en pantalla**: el objetivo *es* el resultado y los KPIs
*son* lo que lo mueve. La distinción está en la estructura, no en un rótulo que haya que
explicar.

## Las cinco decisiones tomadas

Todas del dueño, 06/09/2026. Son restricciones del problema, no opciones a re-discutir.

1. **`/general` se convierte en FOCUS, todo junto.** Una sola pantalla de entrada. No se
   crea `/focus` como tab aparte. (⚠️ `nav.ts:~128` ya matchea `/focus` y esa ruta no
   existe: hoy un link ahí es un 404 con el sidebar marcando General.)
2. **Estructura simple: Q → Objectives → KPIs, sin la capa de áreas.** El árbol completo de
   Mauricio (MCI → áreas → objetivos → medidas de predicción) queda afuera. El área se puede
   agregar después como un campo más.
3. **Capacidad instalada = cupo manual.** Un número que el dueño carga, al lado de la meta
   de cash.
4. **Registro de KPIs mixto:** automático donde MaKo ya tiene el dato, manual donde no.
   Cada KPI declara su fuente.
5. **Arranque sugerido:** MaKo propone 5-8 KPIs leyendo el funnel y la fase del negocio, y
   el dueño ajusta o borra. Nunca una pantalla en blanco.

## El modelo de datos

Migración numerada nueva. Las tres tablas con `workspace_id`, RLS prendida sin policies
(sólo `service_role` vía `getTenantDb`) y alta en `TENANT_TABLES` de `lib/workspace.ts`.

```
objectives         ws · anio · quarter(1-4) · titulo · metrica · meta_valor · unidad
                      · orden · estado

kpis               ws · objective_id · nombre · cadencia(diaria|semanal) · compromiso
                      · umbral_verde · umbral_ambar · fuente(auto|manual) · fuente_id

kpi_registros      ws · kpi_id · fecha · valor · origen(auto|manual) · evidencia
```

### Lo que ya existe y no se tira

Las metas de hoy son **tres settings per-workspace** (`app_settings`, PK compuesta
`workspace_id+key`): `objetivo_cierres`, `objetivo_cash_usd` y `objetivo_desde`, leídos en
`getObjetivoProgreso` ([lib/queries.ts:2683](../lib/queries.ts)) y editados desde
[EditarMeta.tsx](../app/general/EditarMeta.tsx).

**Se migran, no se borran:** se convierten en el primer `objective` del Q en curso, con
`objetivo_desde` como inicio del período. Cargar los $20.000 USD sigue siendo cargar un
valor, no escribir código. `EditarMeta` pasa a editar el objetivo del Q y le suma el campo
de cupo.

### Capacidad instalada: se pregunta a medias

- **El cupo máximo** es el setting manual. No se puede derivar de nada.
- **Los clientes activos NO se preguntan**: salen del CRM, que ya los sabe
  (`getMrrActivo`, [lib/queries.ts:745](../lib/queries.ts)).

Sólo se pide lo que no se puede derivar — la regla de minimizar configuración.

⚠️ **Consecuencia asumida del cupo manual:** no se mueve solo. Y la frase de Mauricio es
justamente *«si… me quita tareas, eso va a poder aumentar mi capacidad instalada para poder
generar los 20 mil»* — o sea que la palanca que él más valora es invisible salvo que alguien
suba el número a mano. Mitigación barata: al cerrar el Q, MaKo pregunta si subió la
capacidad. No es un pendiente, es un efecto conocido de una decisión tomada.

## La pantalla

**La inversión más importante: hoy el norte es gigante y la acción no existe. Se da vuelta.**

`HeroGoal` es hoy un bloque oscuro enorme con el contador `{actual}/{meta}` y la barra de
bloques (`page.tsx:277-349`). Si `/general` es FOCUS, ese bloque **se encoge a una tira de
una línea** y el espacio grande se lo lleva la acción.

```
┌─ TIRA DEL Q ────────────────────────────────────────────────┐
│ Q3 2026 · faltan 24 días   $12.400 / $20.000 ▓▓▓▓▓▓░░ 62%   │
│                            Clientes 6 / 8 · lugar para 2     │  #219
└──────────────────────────────────────────────────────────────┘

┌─ AHORA ─────────────────────────────────────── grande ──────┐
│ Grabá los 3 videos que faltan de la semana                   │  #523, #285
│ Porque · «Videos publicados» está en rojo (4 de 7)           │
│ Debería mover · agendas de la semana que viene               │
│ Vos · progreso 4/7 · MaKo revisa el lunes                    │
│                              [ Ir a Content Machine → ]      │
└──────────────────────────────────────────────────────────────┘

┌─ KPIs ────────────────────────────────── esta semana ───────┐
│ ● Videos publicados      4 / 7        rojo                   │  #326  LO NUEVO
│ ● Inversión diaria       $55 / $55    verde                  │
│ ● Llamadas agendadas     3 / 5        ámbar                  │
└──────────────────────────────────────────────────────────────┘

▸ Semáforo del negocio (2 urgentes, 3 a vigilar)     lo de hoy, plegado
▸ Pendientes de marcar (4)                           lo de hoy, plegado
```

Los seis campos obligatorios del bloque AHORA los fijó el dueño y están en la #523: acción,
razón, resultado esperado, responsable, progreso y siguiente revisión — más el **origen** de
la prioridad, sin el cual la pantalla es una orden sin fundamento.

## El seed: qué KPIs propone MaKo

De dos fuentes que ya están cargadas:

- **`funnel_config`** — las etapas reales del cliente, que ya es fuente de verdad.
- **`lib/fase-diagnostico.ts`** — la fase del negocio (1-5), su cuello y su hito.

**Regla de la propuesta: MaKo prefiere KPIs que puede medir solo.** Eso maximiza la mitad
automática del registro mixto, que es la que sobrevive a la segunda semana.

Fuentes automáticas ya disponibles hoy:

| KPI | De dónde sale |
|---|---|
| Inversión diaria | `marketing_metrics_daily` (spend) |
| Agendas | `getAgendasBreakdown` |
| Cierres · Cash cobrado | `getRevenueBreakdowns`, tabla `pagos` |
| Leads nuevos | CRM |
| Llamadas analizadas | Fathom / `lib/closing.ts` |
| Vistas del VSL | `vsl_events` |
| Videos publicados | Content Machine / Instagram (parcial) |

Todo lo demás es manual.

## ⚠️ La regla que gobierna un KPI automático

**Un KPI cuya fuente falla NO reporta cero: reporta «no pude leer».**

Es la misma distinción de `lib/sources.ts` —que ya separa «la fuente no está» de «la fuente
dice cero», y por eso `/marketing` se ve honesta— aplicada al tablero de KPIs. Sin esto, un
timeout de Meta pinta el KPI de inversión en rojo y dispara una acción prioritaria falsa.

Por eso **la tarea #165 no va al final: es prerrequisito de F1.** La pieza que le falta ya
está escrita y desmontada: `SourceStrip` ([app/_components/SourceStrip.tsx:19](../app/_components/SourceStrip.tsx))
sólo lo monta `DashboardHeader`, que **no lo importa ninguna página** — es un componente
huérfano.

## El orden

| Fase | Qué | Tareas |
|---|---|---|
| **F0** | Quarters + Objectives. Migrar los 3 settings al Q en curso | 632, 680 |
| **F1** | KPIs: modelo, registro mixto, semáforo por KPI, seed desde funnel + fase. **Incluye el estado «sin datos»** | 326, 633, **165** |
| **F2** | `/general` reescrita como FOCUS: tira del Q + AHORA + KPIs + lo viejo plegado | 523, 285, 219 |
| **F3** | Cadencia y alertas: desvío del objetivo, recordatorio de planificar el Q siguiente | 286, 634 |
| **F4** | Vista por Q en el plan y el Perro leyendo objetivos para priorizar | 635, 680 (2ª mitad) |

## Lo que queda afuera, a propósito

- **La capa de áreas** de la metodología de Mauricio (decisión 2). Se puede sumar como campo.
- **Las MCIs.** Regla suya, textual: *«MCIs: NO se modelan en base de datos ni se muestran en
  vistas»* — van como texto en el `CONTEXTO.md` de cada repo de cliente.
- **`/focus` como ruta propia** (decisión 1). Queda pendiente decidir si se borra el match de
  `nav.ts` o se lo deja apuntando a `/general`.
- **Rentabilidad neta** (#194). Es el módulo de finanzas, otro tema.

## Sin resolver

- **¿El Perro Guardián define los OKRs y el dueño ajusta?** La #633 dice que sí «según
  aclaración del dueño». Choca de frente con la regla de `AGENTS.md` sobre juicios derivados
  y con el caso ya pagado del score de proyectos: un número que expresa una PRIORIDAD no se
  deriva con una cuenta, y si lo produce un modelo tiene que cumplir su propia metodología
  con una segunda capa determinista. Hay que decidirlo antes de F4.
- **Qué cuenta como «cliente activo»** para la capacidad. `getMrrActivo` es el candidato, pero
  no cubre a un cliente de pago único todavía en entrega.
- **El umbral de «desvío significativo»** de la #286 (¿% por debajo de la meta prorrateada al
  día? ¿días seguidos sin agenda?). Sin ese número la alerta no se puede escribir. Recordar
  que un umbral es un proxy y hay que correrlo contra los datos reales antes de shippearlo.

## Gotchas encontrados escribiendo esto

- **La #286 tiene el `detalle` corrupto**: adentro tiene pegado **tres veces seguidas** el
  texto de una tarea de Closing Analyst («que MaKo detecte el guión de ventas»). Tomarla como
  especificación sin mirarla lleva a construir otra cosa.
- **`nav.ts` matchea `/focus` y esa ruta no existe.**
- **La #523 tiene score 80 y deadline 28/08**, vencido. Es la de score más alto del cluster y
  la que define el contrato de la pantalla.
- El script [scripts/separar-foco.ts](../scripts/separar-foco.ts) ya partió «General» en tres
  proyectos (General diagnostica · Foco manda · Dashboard analiza) y movió seis tareas. Con la
  decisión 1 —una sola pantalla— el reparto de PROYECTOS sigue siendo útil, pero ya no
  describe un reparto de PANTALLAS.
