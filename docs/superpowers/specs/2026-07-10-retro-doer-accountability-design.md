# Retro Doer — Diagnóstico con criterio + Rendición de cuentas + Pulso diario

- **Fecha:** 2026-07-10
- **Estado:** Diseño para revisión (brainstorming → writing-plans)
- **Sub-proyecto:** S1 del programa "app viva / doer" (ver memoria `app-viva-pilares-mapa`)
- **Fuera de alcance:** S2 (Home "Hoy" simple), S3 (auto-cierre de experimentos), S4 (semáforo vivo), S5 (accionar desde WhatsApp). Este spec **alimenta** a S2 y coordina con S5, pero no los construye.

---

## 1. Problema

La app hoy **piensa** (Retro da veredictos) y **propone** (crea experimentos/tareas al aceptar), pero:

1. **La rendición de cuentas es falsa.** La fase "memoria" del retro (`lib/retro-pipeline.ts` → `armarSeguimiento`) mira solo si el usuario **clickeó** Aceptar (`item.status`), no si el trabajo se **hizo**. El link `experimento_tareas.retro_id` ya se persiste (retro-pipeline.ts:606) pero **nunca se lee**. Resultado: una tarea aceptada figura "✓ hecha" aunque nadie la haya tocado.
2. **No es proactivo.** El único cerebro integral es el retro on-demand, caro y lento (~9 llamadas Opus 4.8, ~13 min). Sin un disparo periódico barato, MaKo no puede "buscarte" para reclamar o avisar.
3. **El diagnóstico no tiene criterio garantizado.** La fase de diagnóstico por área depende de lo que la IA "note" ese día; puede pasar por alto patrones clásicos de fuga (escalar no-ganadores, escalado incorrecto, etc.).

## 2. Objetivo

Convertir Retro en un **diagnosticador con criterio** que:
- corre un **catálogo de patrones** de fuga (y de wins) sobre datos reales,
- **cierra el loop de rendición de cuentas** (verifica ejecución real y reclama con base),
- **late** vía un pulso diario barato que reclama/avisa por campanita + WhatsApp,

sin sobre-estructurar: **la IA queda libre en el juicio; el código, firme en los hechos.**

## 3. Principio rector (transversal)

> **El catálogo son ejemplos/lentes, no gates. La IA es libre; el código es la verdad.**

- El catálogo (fugas + wins) es un **piso, no un techo**: MaKo lo tiene siempre a la vista para no pasar por alto los patrones grandes conocidos, pero puede **(a)** levantar algo fuera de la lista, **(b)** saltear un patrón que no aplica, **(c)** repriorizar a su criterio.
- Lo único estricto no es una traba a la creatividad, es **honestidad**: los **números** y el **"¿lo hiciste?"** los aporta el **código**, no MaKo. Así el reproche y la win son **verdad**, no invento. (Mismo principio que ya rige el retro: la evidencia la calcula el código; MaKo interpreta y decide.)
- Las reglas de disciplina (terminá-antes-de-más, restraint) son el **sesgo/default** de MaKo, aplicado con criterio y con permiso de **saltárselo con una razón** — no un mecanismo rígido.

---

## Sección 1 — El catálogo

### 1.a Catálogo de FUGAS (v2)

Cada patrón: la IA lo juzga contra el dato (no es una regla dura), con la metodología como criterio. Casi todos reusan señales ya calculadas — en particular **`getSenalesRecon` ya computa las 2 señales de Jan** (intención vs leads + ritmo de techo) y un veredicto `explorando|validada|falso_positivo|apagar` por anuncio.

| # | Patrón | Criterio (metodología Recon / dato) | Qué propone |
|---|---|---|---|
| 1 | Escalar no-ganadores | veredicto Recon por ad; si **ningún** ad pasó las 2 señales → no hay ganador | según cuán perdedor: pausar/bajar **+ lanzar campaña de testing Recon (3×3)** para *crear* el ganador |
| 2 | Gasto↑ / resultados↓ | no asume creativo: pondera escalado incorrecto / muchos cambios / apagaste al ganador / falso positivo | apuntar a la causa real |
| 3 | Poca variedad = misma razón | variedad de **razones de compra / audiencias / ángulos**, no # de creativos (híbrido, ver 1.d) | 3×3 / 6 ángulos |
| 4 | Huecos del funnel | leads sin nutrir / sin recordar | **redirige a la tab** (nutrición/email) con su onboarding, no solo "prendelo" |
| 5 | Escalado incorrecto | vertical vs horizontal + ritmo (3 días > techo) + "regla del 20% es falsa" | subir al ganador vs bolitas de nieve |
| 6 | Demasiados cambios de golpe | # de cambios grandes (ABO↔CBO, apagar ganador, cambiar landing/VSL/oferta) → resetea el aprendizaje de Meta | frená los cambios, dejá aprender |
| 7 | Cobranza vencida | vencidas > 0; si es **recurrente** → el problema son los límites/términos con clientes | seguimiento ya + revisar condiciones de cobro |

Extras directos (ya salen con data existente): cuello del funnel, objeciones que matan cierres, cuenta Meta en riesgo.

### 1.b Catálogo de WINS

Una **win** = evento **material** (toca plata o valida un aprendizaje) que amerita una jugada. No "entró un lead", no "todo bien". Mismo restraint.

| Win | Disparador | Jugada |
|---|---|---|
| 🏆 Ganador encontrado | un ad de testeo pasó **las 2 señales** → veredicto `validada` | escalá (vertical si hay ritmo, horizontal si el charco es chico) |
| 📈 Escala sostenida | subiste a un ganador y aguantó (no fue falso positivo) | seguí / sumá bolitas |
| ✅ Experimento validado | cerró con veredicto validada = verdad nueva | aplicá el aprendizaje |
| 💰 Récord | mejor semana en cash / ROAS / cierres vs histórico | replicá lo que lo movió |
| 🔓 Cuello destrabado | un escalón del funnel superó su benchmark | consolidá el cambio |
| 🎯 Cumpliste y pagó | hiciste lo prometido (🔴→✅) **y** la métrica que apuntaba se movió | reconocimiento + la prueba en números |

Una win **puede saltar la cola** de "terminá lo anterior primero" (un ganador recién encontrado es plata con fecha de vencimiento → escalar ahora).

### 1.c Catálogo editable desde Admin
Los patrones (fugas + wins) se administran desde una **sección en Admin** (agregar/editar/sacar) sin tocar código. Cada patrón = { nombre, descripción/criterio para la IA, señales que consume, plantilla de propuesta }. Empezamos con los de arriba; crece con el tiempo.

### 1.d Detector #3 — profundidad híbrida
Por defecto **simple**: detecta poca variedad de razones/ángulos y propone generar más (marco de 6 ángulos). Si detecta que **ni siquiera hay razones de compra / audiencias definidas**, ahí sí manda a hacer ese trabajo base primero. Respeta "simple" sin perder profundidad cuando falta la base.

### 1.e Conocimiento
Cargar los 3 PDFs de la metodología Recon (Jan / Biz Scaling) al **conocimiento de MaKo** (RAG, área `ads`) para que los detectores —y el futuro writer de creativos— citen la metodología real, no generalidades.

---

## Sección 2 — El loop de rendición de cuentas

**Fix central:** al arrancar cada retro **y** el pulso diario, MaKo joinea `experimento_tareas` por `retro_id` y clasifica cada compromiso del retro anterior en **4 estados reales**:

- ✅ **Hecho** — la(s) tarea(s) están en `hecho`.
- ◐ **En curso legítimo** — arrancado y avanzando.
- 🔴 **Prometido y NO hecho** — aceptado y sin tocar (estado nuevo; hoy no existe).
- ⚪ **Nunca tocado** — ni se miró.

**Experimento ≠ tarea.** Un experimento normalmente necesita **varias tareas** para ejecutarse. "Cumpliste tu parte" = esas tareas hechas. Que el experimento **valide o refute** es el **otro eje** (el resultado), separado de la ejecución.

**El reproche (con base).** Cuando hay 🔴, MaKo lo ata a la fuga en plata, con nombre + número + días: *"El detector #1 sigue rojo porque los 3 creativos que te propuse hace 8 días siguen sin grabar. Esto no es magia — hasta que no los grabes, seguís quemando en no-ganadores."* El texto es **editable** (calibrar cuánto aprieta).

**Disposición de disciplina (no gate):**
- **Terminá antes de más:** mientras haya compromisos sin terminar, el default de MaKo es **no apilar cosas nuevas** y empujar a cerrar lo anterior. Excepción: algo **evidentemente más grave** (fuga en plata mayor que la del compromiso pendiente) → MaKo repriorza y **lo dice explícito**.
- **No re-proponer lo ignorado:** un item 🔴/⚪ no vuelve a proponerse como nuevo; MaKo **escala el reproche** en su lugar (salvo que deje de ser relevante).

**Ledger rodante de compromisos.** El seguimiento cruza **varios retros**, no solo el último (hoy `armarSeguimiento` usa `limit(1)`). Casi todo derivable de tablas existentes (`experimento_tareas`: `retro_id`, `estado`, `hecho_at`; `retros.reporte.plan[].status`); a lo sumo una columna chica para "veces ignorado".

---

## Sección 3 — El pulso diario (el latido)

**Qué es:** un chequeo **diario y barato** (NO el retro de 13 min) que corre solo y busca al usuario.

**Qué corre:** (1) el chequeo de rendición de cuentas (los 4 estados, sobre todo 🔴), y (2) los detectores **baratos** del catálogo (los que salen de `getSenalesRecon` + señales ya calculadas). Los detectores **finos** y el cruce entre patrones quedan para el retro a fondo.

**Cómo se mantiene barato:** primero corre las señales por **código** (gratis); solo si hay algo real, **una** llamada a un modelo barato para redactar/priorizar (elección OpenAI-simple vs Claude según `openai-simple-claude-analisis`, se decide en el plan). **Nunca** spamea "todo bien".

**Cuándo avisa:** solo cuando hay motivo — un 🔴, un patrón nuevo, un experimento listo para cerrar, una **win** material, o una urgencia. Restraint.

**Dónde:** la **campanita** in-app (tabla `notificaciones`, mig 0048) + el **reporte diario a WhatsApp** reusando el cron `reporte-diario` + la ventana `reporte_mako` + `lib/notify.despacharReporte` que **ya existen** (no un canal nuevo). Además **alimenta la vista "Hoy" simple** (S2): lo que el pulso destila es lo que se ve ahí.

**Qué NO hace todavía (S1):** avisa y reclama; **no acciona** (pausar campañas, etc. = S4/S5). Si detecta que cambió mucho, **sugiere correr un retro a fondo**.

---

## 4. Cambios de datos (nivel diseño)

- **Reusar (sin migración):** `experimento_tareas.retro_id/estado/hecho_at`, `retros.reporte.plan`, `getSenalesRecon`, `compareMTD`, `getFatigaAdsets`, `getCuotasPendientes`, `getMetaAccountHealth`, `notificaciones` (mig 0048), cron `reporte-diario` + `lib/notify`/`lib/reportes`.
- **Nuevo (chico):** tabla/columna para el **catálogo editable** (patrones de fuga + wins, admin) · columna "veces ignorado" para el ledger · posiblemente una tabla ligera de **compromisos** si el derivado no alcanza (a decidir en el plan). Todo tenant-scoped (`getTenantDb`, whitelist `TENANT_TABLES`).
- **Prompt:** `RETRO3_CEREBRO_SYSTEM` gana el seguimiento enriquecido (hecho/no-hecho real) + la instrucción de reproche/reconocimiento + el catálogo como ejemplos-no-gates; editable vía `getPromptText` (registro central).

## 5. Riesgos

- **Costo del pulso:** llamar a la IA a diario por workspace quema saldo → pre-filtro por código, un solo call barato, solo cuando hay algo.
- **Falsos reproches:** si el join a ejecución está mal, MaKo reclama algo ya hecho → los estados salen del código, con tests sobre `armarSeguimiento`.
- **Coordinación:** el canal WhatsApp-al-dueño lo toca **otro Claude** (S5) — el pulso **reusa** `reporte-diario`/`notify`, no duplica; coordinar antes de tocar esos archivos.
- **Sobre-estructura:** vigilar que el catálogo no se vuelva rígido → el principio rector (ejemplos-no-gates) es explícito en el prompt.

## 6. Criterio de éxito
- El seguimiento del retro refleja **ejecución real** (no el click); un 🔴 aparece cuando corresponde y desaparece al hacer el trabajo.
- El pulso diario reclama/avisa por campanita + WhatsApp **solo cuando hay motivo**, y nunca "todo bien".
- Los detectores del catálogo aparecen con criterio (metodología Recon) **y** la IA puede salirse de la lista.
- Las wins materiales se notifican; "🎯 cumpliste y pagó" cierra el loop por el lado positivo.
