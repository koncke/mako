# Pruebas A/B en MaKo (25/10/2026)

**El pedido.** Martín, 25/10/2026, textual: «También quiero implementar pruebas A/B en muchas partes de la app... Como por ejemplo
en landing, con los datos que tenemos, tenemos el mapa de calor, los clicks que hacen, etc... Al igual que el Media Buyer AI, que
toma desiciones solo, puede haber un Landing AI que haga pruebas A/B, que al detectar si una sección no es vista que haga
variaciones, variaciones en el hook, en los copy, etc... Lo mismo con Automations, podemos poner una tarjeta que sea "Prueba
A/B". Piensa en que otros lados podriamos». Y: «Todo, todo siempre tiene que ir a la API, todo MaKo se debe poder utilizar por API».

Se diseñó con cinco lectores (landing, automations, motor, inventario, cómo lo hacen otros), un diseñador y un crítico que
verificó en el código y simuló pruebas A/A. Abajo van el diseño y la crítica completos. **Donde chocan, MANDA LA CRÍTICA.** Este
encabezado resume lo que decidió el Cerebro con las dos a la vista.

## Lo que decide el Cerebro (Martín: «no hagas preguntas»)

1. **Un solo motor** (`lib/pruebas/`: asignar, juez, volumen, métricas, store) y sus tablas, para todas las superficies.
   `experimentos` sigue siendo el canal de verdades, no el motor.
2. **El juez es código, con horizonte FIJO.** `volumen.ts` calcula el n por rama ANTES de arrancar y «gana» se decide sólo en esa
   mirada. Las lecturas de antes sólo pueden CORTAR POR DAÑO, con 99,5 %. **El test del juez simula pruebas A/A con el
   calendario real de lecturas y exige ≤ 5 % de falsos ganadores: es la puerta para todo lo que sigue.** (Medido por el crítico:
   mirar todos los días con «95 % dos días seguidos» da 10-35 % de falsos ganadores con este volumen.)
3. **Una prueba sin potencia nunca es «no funciona».** Cortar temprano deja de servir la rama y el veredicto queda
   `no_concluyente`. `refutada` sólo con daño demostrado en el horizonte fijo. El aprendizaje cita el INTERVALO, no el punto, y el
   texto de la IA se valida contra los números (si no pasa, plantilla).
4. **Decide una métrica de conversión por persona, congelada al crear la prueba** (la lista exacta de destinos o eventos que
   cuentan). El alcance de una sección es diagnóstico y guardrail, nunca la métrica que decide. «Agendó» y «respondió» se
   congelan en la asignación (estado previo y primer resultado), porque hoy son estados que se reescriben.
5. **Reparto fijo, pegajoso y salado con el id de la prueba. Sin bandido en v1.** Editar una rama o cambiar porcentajes abre una
   época nueva (automatización) o detiene la prueba (landing).
6. **Automations: tarjeta nueva de clase `ab`, no una condición** (el diseño obvio era el equivocado). Es TRANSPARENTE para
   `condicionDeArriba`, `minutosAntesDeReunion` y las reglas de forma (si no, los recordatorios pierden su guarda). Un helper
   `esBifurcacion()` y la lista de los ~70 `=== 'condicion'` revisados en el commit. Sin prueba corriendo, todo va a A y la tarjeta
   lo dice; nunca un sorteo sin registro. B copia sólo las tarjetas que se prueban y vuelve a unirse al flujo.
7. **Landing AI: sólo en páginas que sirve MaKo (Web Generator).** Las de afuera pasan por «Replicar». Primero se MIDE qué sección
   se ve (un evento acumulado `secciones`, que observa los hijos de `.gm-libre-seccion` porque `display: contents` no tiene caja, y
   que NO entra a `getTrackingEvents`). Después se sirve el A/B desde `responderPublico` con una cookie propia del servidor
   (`mko_ab_<prueba>`, HttpOnly). Sin reglas por User-Agent para terceros (cloaking): sólo el lector de MaKo, la vigilancia y la
   vista previa van fijos a A. B debe tener los mismos pagos, formularios, links y `htmlLibre` que A, o se rechaza.
8. **Landing AI apagado por defecto; al prenderlo, «propone»; el piloto lo prende cada negocio, y en piloto sólo cambia
   estructura: los cambios de texto siempre con aprobación.** Nunca toca precio, oferta, garantía, links, formularios, pagos ni
   Pixel. «Aplicar» sólo si no hay borrador sin publicar. Va en todos los planes (escribe con la IA del negocio).
9. **No entran como pruebas:** las variantes anti-ban de WhatsApp, las variaciones del Media Buyer y el VSL de Panda (nada de eso
   es aleatorio). Se pueden LEER como dato, nunca como verdad. Sin migración de `variante` en `nutricion_envios`: se deduce de
   `texto_enviado`.
10. **El setter (AI Step) queda para un diseño propio**: es lo que más mueve «agendó» y la tarjeta no lo puede probar.
11. **Todo por la API de MaKo** (crear, ver, aprobar, detener, aplicar, deshacer), en la misma entrega de cada tanda.
12. **Lo que espera a Martín:** mostrar EN PÚBLICO una versión escrita por la IA en una landing de MaKo (la primera prueba real en
    hola-mako.site y la portada de hola-mako.com). Hasta su sí, el ws9 queda en «propone».

## Reparto

| Tanda | Qué | Chat |
|---|---|---|
| A1 | Motor puro `lib/pruebas/` (asignar, juez con horizonte fijo, volumen, métricas) + el test A/A ≤ 5 % | Automations |
| A2 | Tablas + store + un cron diario + `concluir` → `experimentos` (formato `ab:` en `fmtVal`, «A / B») | Automations |
| A3 | La clase `ab` con todas sus puertas, la tarjeta, «Probar», Métricas, Crear/Editar con IA y la API | Automations |
| L1 | Medir qué sección se ve (evento `secciones`, `alcancePorSeccion`, el dato en el Analyst) | Landings |
| L2 | Servir el A/B con su medidor de conversión adentro; vista previa `?variante=B`; publicar a mano detiene | Landings |
| L3 | El agente (oportunidades, propone/piloto, historial, deshacer, API) | Landings |

---

# Anexo 1 — El diseño (lo corrige el Anexo 2)


Lo pidió Martín el 25/10/2026: «también quiero implementar pruebas A/B en muchas partes de la app».

Leí `C:/dev/wt-push-q` en `2ea62638c` (tren-j, 25/10 11:33) sin modificar nada. Lo que va marcado **(sin confirmar)** no lo pude medir. Las cuentas de volumen son mías, con la aproximación n ≈ 16·p(1−p)/Δ². El test del juez tiene que fijar los números reales.

---

## 1. La idea en 5 renglones

1. MaKo prueba dos versiones de algo al mismo tiempo (una landing, un mensaje, un camino de una automatización). Reparte a las personas al azar, siempre a la misma persona en la misma versión, y se queda con la que funciona mejor.
2. En la landing hay un **Landing AI** que trabaja como el Media Buyer. Detecta qué sección no ve nadie y dónde nadie toca, escribe la versión B (hook, copy, orden) con la IA del negocio y la prueba. Después propone la ganadora, o la aplica sola si el dueño lo prendió.
3. En Automations hay una tarjeta **«A/B TEST»**. Parte el camino en A y B con un porcentaje para cada una, cuenta quién respondió, agendó o pagó en cada rama y dice cuál ganó.
4. Todas las superficies usan **un solo motor**: el mismo reparto, el mismo juez escrito en código y el mismo registro. Cada conclusión queda en `experimentos` como verdad del negocio.
5. Con el volumen de hoy, la mayoría de las pruebas va a terminar en **«todavía no se sabe»**. El motor lo dice con los números y solo declara ganadoras cuando la diferencia es grande.

---

## 2. El motor compartido

### 2.1 Lo que ya existe y por qué no alcanza

- **`experimentos` no es un A/B.**
  - La tabla (`supabase/migrations/0047_experimentos.sql:26-68`) compara antes contra después sobre el embudo de toda la cuenta (`medir`, `lib/experimentos.ts:256-280`; las métricas salen de `getMarketingWindow`, `:132-150`).
  - No tiene ramas, unidad ni asignación.
  - El veredicto lo escribe un LLM (`EXP_CLOSE`, `lib/experimentos.ts:565-575`).
  - Se queda como **canal de verdades** y como modo antes/después para lo que no se puede repartir (precio, oferta).
- **Las `variantes` de un mensaje no son ramas.** Son anti-ban: se sortean con `Math.random` en cada envío y no queda registro de cuál salió (`lib/nutricion-canal.ts:111-124`).
- **`prueba` del Pixel no es una variante.** Es la marca `?mko_test` del probador (`lib/landing-token.ts:1503-1515`) y todas las lecturas descartan esas filas. Si el A/B se guardara ahí, desaparecería todo el tráfico de la prueba.
- **Lo que sí se copia tal cual:**
  - El reparto determinista que decide el servidor: `huellaDeVisitante` y `grabaA` (`lib/replay-contrato.ts:537-564`; `app/api/track/vsl/route.ts:396-420`).
  - El molde del Media Buyer (ver 2.8).

### 2.2 Tablas: migración nueva «pruebas_ab» (sin número)

Reglas que valen para todas:
- `workspace_id bigint not null`, **sin default**. Las tablas viejas tienen `DEFAULT 1` y el ws1 es un cliente (`0054_workspaces.sql:51-63`).
- RLS prendido sin políticas, más `revoke` a `anon` y `authenticated`.
- Van en `TABLAS_DE_INQUILINO` (`lib/tablas-de-inquilino.ts`, como `media_buyer_*`) y **no** en `TENANT_TABLES` (`lib/workspace.ts:87`). Las lee y escribe `lib/pruebas/store.ts` con el cliente de servicio y el ws explícito, porque la página pública y el cron no tienen sesión.
- La migración se aplica **antes del deploy**, y el código tiene que aguantar las tablas ausentes («FALTA LA MIG», como `lib/media-buyer/store.ts`).

**`pruebas`** (una fila por cosa que se prueba)

| columna | contenido |
|---|---|
| `id` bigint identity pk, `workspace_id` | |
| `superficie` | check: `landing` / `automatizacion` / `portada_mako` / `anuncios` / `vsl` |
| `lugar` jsonb | landing: `{doc_id, version_base, seccion_id?}` · automatización: `{secuencia_id, nodo_id}` · anuncios: `{ad_madre, ads_hijas[]}` · vsl: `{video_ids[], landing_url}` |
| `clave_lugar` text | `landing:<doc>` / `auto:<secuencia>`. Índice único parcial `(workspace_id, clave_lugar) where estado in ('propuesta','corriendo')`: **una prueba viva por lugar** |
| `titulo`, `hipotesis`, `cambio` | |
| `origen` | `dueno` / `mako` |
| `unidad` | `visitante` / `lead` |
| `metrica`, `ventana_dias` | clave de `lib/pruebas/metricas.ts`; la ventana de atribución se cuenta desde la asignación |
| `guardrails` jsonb | `[{metrica, tolerancia_rel}]` |
| `min_por_rama`, `min_dias` (default 7), `max_dias`, `max_por_rama` | |
| `epoca` int, default 1 | sube cuando se edita una rama o cambian los porcentajes (2.4) |
| `auto_aplicar` bool, default false | el «Que MaKo elija solo» de la tarjeta, o el modo piloto del Landing AI |
| `estado` | `propuesta` / `corriendo` / `detenida` / `concluida` / `descartada` / `vencida` / `deshecha` |
| `veredicto` | `gana_variante` / `gana_control` / `da_lo_mismo` / `no_concluyente` |
| `sirviendo_id` | la variante que recibe el 100 % al terminar |
| `experimento_id` | la fila de `experimentos` con la conclusión |
| `propuesta_vence_at`, `iniciada_at`, `concluida_at`, `created_at`, `updated_at` | |

**`prueba_variantes`**
- Columnas: `id`, `prueba_id` (fk, on delete cascade), `workspace_id`, `clave` ('A'…'D', unique con `prueba_id`).
- `es_control`: A es «Sin cambio», no se borra ni se edita.
- `nombre`, `peso` (de 0 a 100, suman 100).
- `contenido` jsonb: en landing, la foto armada con `armarFoto` (`lib/editor-landing/publicar.ts:116`) o `{doc_id}` para la portada; en automatización, `{nodo_destino}`.
- `firma`: hash del contenido de la rama.
- `porque`, `autor` (`dueno` / `ia`), `activa`, `cortada_motivo`.

**`prueba_asignaciones`** (quién vio qué)
- `prueba_id`, `unidad` text, `variante_id`, `workspace_id`, `epoca`, `asignada_at`.
- PK `(prueba_id, unidad)`.

**`prueba_lecturas`** (los números de cada día; quedan para auditar y nunca se recalculan hacia atrás)
- `prueba_id`, `fecha`, `variante_id`, `n`, `n_maduros`, `x`, `guardrails` jsonb, `p_mejor`, `perdida`, `lift_p5`, `lift_p95`, `mde`.
- PK `(prueba_id, fecha, variante_id)`.

**`prueba_historial`** (el porqué de cada decisión, con el molde `numeros[{condicion, valor, porQue}]` de `lib/media-buyer/tipos.ts:97-127`)
- `id`, `prueba_id`, `workspace_id`, `at`.
- `accion`: propuesta / aprobada / arrancada / reiniciada / cortada / retractada / concluida / aplicada / detenida / deshecha / vencida.
- `quien`: `mako` o el id del usuario.
- `porque`, `numeros` jsonb.

**Segunda migración, con el agente (tanda 6): «pruebas_config»**
- Columnas: `workspace_id`, `superficie`, `encendido` (default false), `modo` (default `'propone'`, check `propone` / `piloto`), `updated_at`. PK `(workspace_id, superficie)`.
- Sin fila, el agente está apagado, igual que `CONFIG_POR_DEFECTO` (`lib/media-buyer/tipos.ts:44-61`).

**No hace falta una tabla de eventos nueva.** Cada medidor lee lo que ya existe, con fecha posterior a `asignada_at`:
- `vsl_events` y `landing_visits`, por `visitor_id`;
- `nutricion_envios`, `nutricion_inscripciones` y `leads`, por `lead_id`.

### 2.3 Asignación (`lib/pruebas/asignar.ts`, función pura con test)

- Si la unidad ya tiene fila en `prueba_asignaciones`, recibe esa rama. Siempre.
- Si no la tiene:
  - se calcula `huellaDeVisitante(\`${prueba_id}:${epoca}:${unidad}\`) % 100` contra los pesos acumulados de las ramas activas;
  - se hace `insert … on conflict do nothing` y se relee.
- **La sal con el id de la prueba es obligatoria.** Sin ella, la rama A sería exactamente el grupo de sesiones que graba `grabaA` (usa la misma huella, `lib/replay-contrato.ts:564`), el mapa de calor de B saldría vacío y dos pruebas simultáneas quedarían correlacionadas.
- **La unidad:**
  - En landing, `visitor_id`.
  - En automatización, `lead_id`: la persona, para que si vuelve a entrar caiga en la misma rama, y porque agendó y pagó se miden por lead.
  - Se filtra `visitor_id = 'desconocido'` (`app/api/track/optin/route.ts:203`).
- Si la prueba ya tiene `sirviendo_id`, se sirve esa variante y **no** se escribe asignación.

### 2.4 Reparto fijo, y por qué

- **En v1 los pesos son fijos:** 50/50, o los porcentajes que el dueño pone en la tarjeta, con un mínimo de 10 % por rama. Son pegajosos y quedan guardados.
- **Si se cambian los porcentajes o se edita una rama mientras corre, empieza una nueva `epoca`.** Desde ahí solo cuentan los que entran después, y la tarjeta lo dice: «Reiniciada el 12/11: cambiaste B». Unbounce, Braze y Klaviyo hacen lo mismo.
- **En landing, publicar A a mano detiene la prueba** (2.7 y 3.2), porque B se armó sobre la A anterior.
- **No hay bandido (Thompson) en v1:**
  - Con 2 ramas, una prueba fija rinde más que un bandido (GrowthBook).
  - Mover pesos mientras el tráfico cambia de una semana a otra produce la paradoja de Simpson (Optimizely la corrige por épocas).
  - Un bandido no deja una conclusión firme, y las conclusiones tienen que vivir en `experimentos`.
  - Thompson queda para después, solo con 3 o más ramas, un piso del 20 % por rama y análisis por época.
- **No hay holdout permanente en v1.** El 10 % de las 4.093 visitas al mes del cliente más grande (`docs/hallazgos-landing.md:4398`) son unas 400 visitas, que no alcanzan para medir nada. El control «Sin cambio» de cada prueba hace de respaldo (Webflow).

### 2.5 El juez (`lib/pruebas/juez.ts`, función pura; el veredicto lo da el código, nunca un LLM)

- **Qué cuenta.** Por rama, `x` éxitos sobre `n_maduros`: los que ya cumplieron la ventana o ya lograron la métrica. Se suman conteos; **nunca** se promedian tasas diarias (el promedio de promedios ya rompió la retención del VSL, `docs/hallazgos-ads.md:170-184`).
- **El modelo.** Posterior `Beta(a0 + x, b0 + n − x)` con un **prior escéptico, igual para todas las ramas**:
  - centrado en la tasa conjunta de la prueba, con peso 10 (`a0 = 10·p`, `b0 = 10·(1−p)`);
  - acerca las diferencias chicas a «da lo mismo», que es lo que frena a los falsos ganadores que aparecen al mirar todos los días;
  - no necesita historia, que un negocio chico no tiene.
- **El cálculo.** 20.000 sorteos con semilla fija, para que la misma lectura dé los mismos números. Salen P(ser la mejor), la pérdida esperada, el intervalo del 90 % del lift y el efecto mínimo detectable con el n real.
- **El muestreo de la Beta se escribe en casa** (unas 40 líneas, Marsaglia-Tsang con PRNG con semilla) y lleva test. No se suma ninguna dependencia.

**Reglas** (los números van en el código junto a su porqué, como `lib/media-buyer/motor.ts:1-35`):

| resultado | condición |
|---|---|
| **GANA** (verdad) | todas las ramas con `n_maduros ≥ min_por_rama`; al menos `min_dias` (7, el ciclo de la semana); P(mejor) ≥ 95 % en **dos lecturas diarias seguidas**; pérdida esperada < 1 % de la tasa del control (la regla doble de VWO); ningún guardrail con P(peor) ≥ 80 % |
| **RETRACTA** | una propuesta abierta se retira si P baja de 90 % (VWO) |
| **CORTA** | P(peor que el control) ≥ 95 % con la mitad del mínimo. Con 2 ramas, la prueba termina en `gana_control`; con más, se apaga esa rama |
| **DA LO MISMO** | con el mínimo cumplido, el intervalo del 90 % del lift queda dentro de ±10 % relativo. Queda el control |
| **TOPE** (`max_dias` o `max_por_rama`) | `no_concluyente` |

- **La decisión de negocio no es lo mismo que la verdad.**
  - Al llegar al tope, **se sigue sirviendo** la rama con P(mejor) ≥ 80 % y pérdida < 1 %. Si ninguna cumple, el control.
  - **Como verdad se registra** solo el «gana» del 95 %. Así un negocio chico aprovecha un «probablemente mejor» sin que MaKo lo cite como un hecho.
- **Qué alcanza a distinguir.** Con 20 personas por rama, 10 % contra 40 % da alrededor de 97 % y gana. 10 % contra 20 % da alrededor de 77 % y sigue sin saberse.
- **Antes de arrancar** (`lib/pruebas/volumen.ts`): calcula n por rama ≈ 16·p(1−p)/Δ² con el ritmo de los últimos 30 días del mismo lugar. Ejemplo de pantalla: «Con tu ritmo (≈25 por día) esta prueba distingue un salto de 10 % a 18 % en ~24 días», o «No llega en 60 días: prueba un cambio más grande».

### 2.6 Métrica: decide la cercana, la final hace de guardrail

- **Una sola métrica de decisión por prueba** (como Coframe, GrowthBook y Braze), y es la cercana. Con 0,2 % de reservas (8 en 30 días sobre 4.093 visitas), decidir por agenda pediría decenas de miles de visitas por rama.
- **Catálogo inicial** (`lib/pruebas/metricas.ts`, con un medidor por superficie):
  - **Landing:**
    - `clic_conversion`: clic al destino de conversión de esa página (`conversionDeLaPagina`, `lib/landing-conversion.ts:77`; el checkout por `RE_CHECKOUT`, `:50`);
    - `alcance_seccion` (sale del evento nuevo de 3.2);
    - `play_manual` y `optin`.
  - **Automatización:**
    - el `estrategia.desenlace.logrado` de cada automatización: respondió, agendó o pagó (`seLogro`, `lib/nutricion-desenlace.ts:66-79`);
    - `clic_email` (por el webhook de Resend).
  - **«Leyó» por WhatsApp no entra:** queda sesgado por quien apaga la confirmación de lectura.
- **Guardrails:**
  - la conversión final (agendó, compró);
  - en automatización, la baja o el bloqueo (**sin confirmar** que ese dato exista por lead).
  - Con menos de 5 eventos finales en total, el guardrail dice «sin dato suficiente» y no frena.
- **Denominador en landing:** asignados ∩ `landing_visits` con `prueba is null`, posteriores a `asignada_at`. Los bots y las vistas previas de WhatsApp piden la página sin correr el Pixel.
  - No se mide sobre `leads`: solo entre el 5 % y el 8 % trae `visitor_id` (`docs/hallazgos-crm.md:5450-5462`).

### 2.7 Al terminar: qué se sirve y dónde queda la conclusión

- **El estado vive en `pruebas`.** Nunca se escribe el ganador en `nutricion_secuencias.pasos` ni en `landing_docs.publicado` como efecto colateral.
- **Con `auto_aplicar` apagado** (el default), MaKo propone con el porqué y los números, y la propuesta vence a las 72 h. **Prendido**, aplica dentro de los topes y avisa.
- **El aviso va al feed** con `crearNotificacion`, como el Media Buyer (`lib/media-buyer/corrida.ts:150`).
  - No va por WhatsApp en v1: los avisos por WhatsApp son automatizaciones del ws9 que configura el super admin. Si se pide, se crea esa fila **pausada**.
- **La conclusión va a `experimentos`**, la tabla del elemento «Experimento» del Dashboard (`/experimentos` redirige ahí, `app/experimentos/page.tsx`). Se escribe una fila con:
  - `estado='cerrado'`, `workspace_id` explícito, `hipotesis` y `cambio`;
  - `metrica='ab:<métrica>'` con su `metrica_label`;
  - `baseline_valor` = tasa de A, `resultado_valor` = tasa de B;
  - `config = {prueba_id, superficie, n/x por rama, p_mejor}`;
  - el veredicto traducido: `gana_variante` → `validada`; `gana_control` y `da_lo_mismo` → `refutada`; `no_concluyente` → `no_concluyente`;
  - el `aprendizaje`: lo redacta la IA del negocio **sobre números ya calculados**, por ejemplo «El hook "X" subió el clic al botón de 9 % a 14 % (A 512 / B 498 visitantes, 96 %)». Sin IA, sale de una plantilla con los mismos números.
- **El canal de verdades:**
  - `resumenExperimentos` (`lib/experimentos.ts:716-737`) ya pasa las `validada` al contexto de MaKo. Hay que sumarle las `refutada` que traen `config.prueba_id`, como «PROBADO QUE NO FUNCIONA».
  - Hay que corregir `lib/mako-prompts.ts:22`, que todavía manda a «la vista de Experimentos», retirada el 17/10.
- **(Sin confirmar)** que `fmtVal` (`lib/experimentos-formato.ts:25`) y `app/dashboard/ElementoExperimento.tsx:110-119` dibujen bien una métrica fuera del catálogo. Si no, se resuelve en el formato y no en `lib/experimentos-catalogo.ts`: ese catálogo lo lee la IA que propone experimentos y empezaría a proponer `ab`.

### 2.8 Lo que se copia del Media Buyer

| Media Buyer | Pruebas |
|---|---|
| Interruptor y modo propone/piloto; apagado si no hay fila (`lib/media-buyer/tipos.ts:14-61`) | `pruebas_config` por superficie. La tarjeta de Automations lleva su propio «Que MaKo elija solo», visible en el flujo |
| Motor puro que propone con porqué y números (`motor.ts`, `tipos.ts:97-127`) | El juez y `oportunidades()`, también puros |
| Clave idempotente por día (`motor.ts:299`, unique en `0332:81`) | Índice único parcial por lugar y `prueba_lecturas` con pk por fecha: correr el cron dos veces no duplica nada |
| Mira el cupo del plan antes de gastar IA (`corrida.ts:108-126`) | Igual, antes de escribir una variante |
| Se abstiene con datos parciales o viejos (`corrida.ts:26-30`, `:82-91`) | Las ventanas terminan **ayer**. Una lectura que falla **no** cuenta como «0 éxitos»: la corrida se marca fallida y no decide. El Analyst se traga los errores a propósito (`docs/hallazgos-landing.md:1833-1861`); acá las lecturas son estrictas |
| Reclama la decisión antes de escribir y relee en vivo (`store.ts:226-234`, `ejecutar.ts:92-144`) | Aplicar = `update … where estado='concluida' and sirviendo_id is null`, y releer `publicado_version` o `pasos` |
| Deshacer solo si nadie tocó después (`ejecutar.ts:240-246`), aunque el interruptor esté apagado (`topes.ts:37-43`) | Igual |
| Variaciones escritas una vez con la IA del negocio: lo que se aprueba es exactamente lo que sale (`variaciones.ts:4-9`) | La B es una foto inmutable |
| No mide el efecto de lo que lanza | 3.6 lo cierra |

La migración 0332 dice «SIN APLICAR» (`supabase/migrations/0332_media_buyer.sql:14`). Se copia el molde, pero no se depende de sus tablas.

### 2.9 La pantalla (una sola, que reusa cada superficie)

- **Mientras corre no hay verde ni rojo.** Un experimento pintado con «confianza» mientras corría ya engañó una vez (`docs/hallazgos-ads.md:1214-1216`). Ejemplo: «Midiendo · día 9 de 28 · A 410 / B 402 · B va adelante (71 %) · Con este tráfico solo se nota una diferencia de ±35 % o más».
- **Nunca p-valores:** «Hay 71 % de chance de que B sea mejor» (como PostHog).
- **Con pocos datos solo se muestran los conteos:** menos de 50 por rama en landing, o menos de 10 maduros por rama en automatización.
- **Finales posibles:** «Ganó B · 12/11», «Empate: quedó A», «Todavía no se sabe: quedó A», «B iba adelante (84 %): quedó B, sin afirmarlo».

---

## 3. Las superficies, ordenadas por impacto × facilidad

| # | Superficie | Impacto | Facilidad | Chat |
|---|---|---|---|---|
| 1 | Tarjeta «A/B TEST» de Automations | alto: el Sprint mueve 50 leads por día | media: una clase nueva son 5 puertas | Automations |
| 2 | Landing AI, etapa 0: medir qué sección se ve | alto: contesta lo primero que pidió Martín | alta: sin migración | Landing Analyst |
| 3 | Landing AI: A/B servido por el servidor + el agente | alto en el ws9; bajo en clientes hasta que tengan landing en Web Generator | baja | Landings (+ Landing Analyst) |
| 4 | Gratis con la tarjeta: fijo vs AI Step, texto vs audio, DELAY, asunto de email, apertura de un DM de IG | medio | alta: no lleva código extra | Automations |
| 5 | Variantes de WhatsApp existentes: registrar cuál salió | bajo | alta | Automations |
| 6 | Portada de hola-mako.com: A «el equipo» vs B «todo junto» | medio: tráfico pago de MaKo, sin medir | media | Landings |
| 7 | Media Buyer: el «Ganador» como prueba madre vs hijas | medio | media: espera la 0332 | Media Buyer |
| 8 | VSL por Panda | bajo | media | Landing Analyst |

### 3.1 Tarjeta «A/B TEST» de Automations (chat «Automations»)

**Qué se puede variar.** Cualquier cosa de la rama: texto, audio vs texto, mensaje fijo vs AI Step, un DELAY de 1 día contra 3, WhatsApp contra email, el asunto, la apertura de un DM de Instagram.

**Métrica.**
- El objetivo que ya tiene la automatización (`estrategia.desenlace.logrado`, `lib/nutricion-desenlace.ts:72`).
- Ventana de 7 días contada desde que la persona entra a la rama, no desde una fecha del calendario: el goteo atrasa los envíos (`docs/hallazgos-chatbot.md:198-221`).
- «Respondió» se mide por inscripción (`enviosRespondidos`, `lib/graficos-datos-puro.ts:283-305`), porque `respondio_at` no lo escribe nadie (`docs/hallazgos-chatbot.md:6890`).

**Dónde se sirve.** En el motor, dentro de `resolverControl` (`lib/nutricion-grafo-motor.ts:210-311`).

**Cómo se ve.**
- Es de la familia de control y se titula «A/B TEST» (los títulos van en inglés, `TITULO`, `lib/flujo-conversacion.ts:556-560`).
- Tiene de 2 a 4 filas del tipo «A · 50 %», que suman 100, en pasos de 5, con mínimo 10. Cada fila es una salida con su ＋. No hay «Si no».
- Se crea con «＋ Prueba A/B» sobre una flecha. A es el camino que ya existe; B es una copia de ese camino (`copiaDeTarjetas` y `pegarTarjetas`, `lib/flujo-copia.ts:135`, `:183`), con el botón «✦ Que MaKo escriba otra versión».
- Arriba muestra el estado (2.9). En cada fila: «B · 50 % — 9 entraron · 3 respondieron (33 %)».
- Casilla «Que MaKo elija solo», apagada por defecto.
- Al terminar, lo nuevo va al 100 % a la rama que quedó, y los que ya están en otra terminan su camino.
- «Dejar solo B» lo hace el dueño editando el flujo y publicando como siempre. Se habilita recién cuando no queda nadie vivo en las otras ramas; si no, dice «Quedan 3 en A».

**Por qué es una clase nueva (`nodo:'ab'`) y no una condición del catálogo.** Este era el diseño obvio, y es el equivocado:
- AGENTS.md lo permite: un nodo nuevo se justifica «cuando el nodo hace OTRA cosa (esperar, bifurcar, saltar)» (`AGENTS.md:9702-9716`).
- Una condición pegada a otra no se puede guardar (`condicion_pegada`, `lib/flujo-forma.ts:35`, `:95`, `:149-150`). Con una condición, «A/B → Contestó» quedaría prohibido.
- La condición tiene «Si no» y elige la primera fila que se cumple, lo que rompe los porcentajes.
- El motor vuelve a evaluar la condición de arriba antes de mandar (`condicionDeArriba`, `lib/nutricion-grafo-motor.ts:449-456`; `lib/nutricion.ts:4698-4720`).
- La tarjeta tiene que mostrar el estado y los números de la prueba.

**Lo que ya existe.**
- El lienzo con ramas y salidas en paralelo (`lib/flujo-grafo.ts:719-760`).
- Cada envío guarda `nodo_id`, `texto_enviado` y `texto_autor` (`lib/nutricion.ts:5504`, `:5523-5524`).
- Métricas por tarjeta (`lib/automatizacion-metricas.ts:103-122`).
- El simulador ya deja elegir por qué salida va una condición (`lib/simulador-grafo.ts:524-535`).

**Lo que falta. Todo entra en UN commit** (la quinta puerta, `AGENTS.md:9702-9712`):
- **Modelo** (`lib/flujo-grafo.ts`):
  - `ClaseNodo` y `claseDe` (`:367`, `:496-501`);
  - `puertosDe` con una salida por rama (`:719`);
  - `siguienteDe` devolviendo null (`:705`);
  - `validarGrafo`: de 2 a 4 ramas, que sumen 100, una sola prueba por automatización, y nunca dentro de «Si responde» ni del AI Step.
- **Motor** (`lib/nutricion-grafo-motor.ts`):
  - `esControl` (`:106-110`);
  - un caso propio en `resolverControl` **antes** del fallback de «Ir a» (`:296-298`). Hoy ese fallback se tragaría la tarjeta como «"Ir a" sin destino»;
  - `ContextoControl` (`:116-135`) suma `unidad` (el `lead_id`) y el estado de las pruebas con las asignaciones, leídos en lote como los hechos;
  - `Resolucion` (`:160-187`) devuelve la rama sorteada, para que `lib/nutricion.ts` escriba la asignación.
- **Guardado:** `NODOS`, `CamposFlujo` y `camposDelFlujo` tienen que sanear `ramas[].pct` (`:1137`, `:1318`); si no, guardar borra el nodo. También `esLineal` (`:1416`).
- **Lienzo:**
  - `TipoNodo` y el ancho de la tarjeta (`lib/lienzo-grafo.ts:29-37`, `:923`);
  - `grafoDeSecuencia` (`lib/flujo-conversacion.ts` ~1003);
  - `MENU_MAS`, `nodoNuevo` y `QueAgregar` (`:1428-1500`);
  - `EditorDeNodo` (`app/automations/FlujoLienzo.tsx` ~1100-1127);
  - un `EditorPruebaAB.tsx` nuevo.
- **Flujos de eventos de MaKo:** corren otro motor (`decidir`, `lib/flujo-pasos.ts:131-161`). Tienen que rechazar la tarjeta con su motivo en `pasosDelEvento` (`lib/aviso-evento.ts:195-235`).
- **«Probar»:** que deje elegir la rama (`lib/simulador-grafo.ts:524`). La prueba real va con envío de verdad, tope de 1-2 por día y nunca en el ws1 (`docs/hallazgos-chatbot.md:5854-5861`).
- **Crear y Editar con IA:** la explicación de la tarjeta va en el **mensaje del usuario**, y solo si el pedido habla de A/B (como `BOTONES_SOCIAL`, `lib/flujo-ia.ts:3562-3570`). Al prompt de sistema le quedan unos 47 tokens antes de que Groq salga de la cascada sin dar error (`AGENTS.md:9695-9696`).
- **API de MaKo:** `ficha_secuencia_mensajes` y lo que edita (`lib/api-mako/areas/chatbot.def.ts:59`, `chatbot.run.ts`), más ver, aprobar y detener la prueba.
- **Métricas:** un bloque «Prueba A/B» con dimensión `rama`, filtrado por `secuencia_id` + `nodo_id`. Hoy Métricas filtra por el **nombre** de la automatización (`lib/automatizacion-metricas.ts:15-18`).
- **Tests que fijan el menú y se van a romper:** `tests/flujo-conversacion.test.ts:294`, `tests/lienzo-sexta-tanda.test.ts:168-170`, `tests/barrido-sexta-datos.test.ts:81-93`.

**Riesgos.**
- **Volumen:**
  - En 45 días salieron 30 primeros WhatsApp en toda la app, todos del ws1 (`docs/hallazgos-chatbot.md:6501`).
  - Solo las campañas tipo Sprint llegan: 50 por día sobre 1.050 leads (`docs/hallazgos-crm.md:10972-10974`).
  - El cupo de WhatsApp es uno por negocio (40 por día de fábrica, configurable desde el 11/10, `lib/nutricion.ts:459-468`).
  - Pasar de 10 % a 18 % de respuesta pide unas 300 personas por rama: unos 24 días.
- **Borrar una rama con gente adentro les cierra la inscripción** (`indiceActual`, `lib/nutricion-grafo-motor.ts:76-87`). Por eso «Dejar solo B» espera a que no quede nadie.
- **Escribir el ganador en `pasos`** dejaría «desactualizado» el borrador que alguien tenga abierto (`app/automations/useBorradorSecuencia.ts:24-30`).

### 3.2 Landing AI (chats «Landing Analyst» para medir y «Landings» para servir, generar y la pantalla)

**Alcance.** Solo las páginas que sirve MaKo: Web Generator (`app/l/[slug]/route.ts` → `responderPublico`, `lib/editor-landing/pagina-publica.ts:916-974`), en hola-mako.site y en los dominios propios de los clientes.

Las landings de afuera (Lovable, WordPress) quedan fuera:
- El Pixel carga con `defer` (`lib/pixel-cargador.ts:57-58`), así que cambiar el texto desde el navegador parpadea justo en el hero.
- En sitios React, el render pisa el cambio.
- El camino para esas páginas es «Replicar» a Web Generator, la misma decisión que ya tomó Martín para «Aplicar» (`lib/editor-landing/diagnostico-aplicar.ts:4-6`).

**Etapa 0: medir qué sección se ve (Landing Analyst, sin migración)**
- **Hoy no se puede saber.** El scroll solo registra hitos de la página entera (`lib/landing-token.ts:2842-2893`). `alcancePorSeccion` vuelve null a propósito (`lib/editor-landing/server.ts:903-912`, `:984`), aunque la pantalla ya lo dibuja (`app/web-generator/editor/dialogos/DialogoAnalitica.tsx:7-16`, `:99`).
- **Evento `seccion` en el Pixel v26** (`SNIPPET_VERSION`, `lib/landing-token.ts:169`):
  - IntersectionObserver sobre `section.gm-tarjeta[id^=t-]` (`lib/editor-landing/especificacion.ts:723`) y sobre `[data-mko-seccion]`;
  - cuenta una sección cuando tiene al menos la mitad en pantalla durante 1 s o más, una vez por sección por visita, con tope de 30;
  - el id va en `detalle` (columna de la mig 0133);
  - llega a todos los que cargan `/m.js` sin volver a pegar nada.
- **Tiene que pasar tres listas blancas que fallan en silencio** (`docs/hallazgos-landing.md:523-591`):
  - entrar a `CONOCIDOS` (`app/api/track/vsl/route.ts:455`);
  - entrar a `getTrackingEvents` (`lib/leads.ts:2797`);
  - quedar **fuera** de `ES_EVENTO_DE_VIDEO` (`lib/vsl-retencion.ts:92`). Esa regex es `^(play|pausa|retoma|fin|exit|p\d+|s\d+)$`: el evento nunca se puede llamar `s<número>`.
- **Cómo se calcula.** `alcancePorSeccion` = visitantes con `seccion` de esa sección / visitantes con pageview (`prueba is null`), en 30 días.
- **Se suma al análisis.** Entra a `getComportamiento` del Analyst («la sección 4 la ve el 12 %»). De paso, hay que corregir su comentario de `lib/landing-analyst.ts:177-181`, que es falso desde la mig 0137.
- **Clics por sección.** El `sel` empieza en `#t-<id>` solo si ningún elemento de adentro tiene id: `selDe` corta en el primer id que encuentra (`lib/landing-token.ts:2783-2798`). **(Sin confirmar)** cuántas secciones de «Diseño editable» quedan sin `t-`; la de las 8 landings usa `#vsl-mako`.

**Etapa 1: servir el A/B (Landings, migración «pruebas_ab»)**
- **El flujo.** En `responderPublico`, solo en modo público y solo si la página tiene una prueba corriendo:
  1. se toma la cookie `nqe_visitor_id`;
  2. si no existe, el servidor la crea: UUID, **no** HttpOnly (el Pixel la lee por JavaScript), SameSite=Lax, 1 año, path=/, del host. El Pixel la reescribe en el dominio corto con el mismo valor, porque la cookie «se (re)escribe siempre» (`lib/landing-token.ts:1492-1499`);
  3. se llama a `asignar`;
  4. se arma el documento con la foto de esa rama;
  5. la asignación se anota después de responder. Si esa escritura falla, la huella da la misma rama en la próxima visita.
- **Cabeceras con prueba:** `Cache-Control: private, no-cache` + `Vary: Cookie`. Hoy es `public, no-cache` (`pagina-publica.ts:852`). El ETag ya es el hash del documento (`:967-973`), así que cambia solo con la rama.
- **Siempre reciben A, sin cookie ni asignación:**
  - los bots (facebookexternalhit, Googlebot, WhatsApp, AdsBot…);
  - `?mako_leer` (`lib/editor-landing/lector.ts:61`);
  - `mirarLanding` (`lib/landing-vigilancia.ts:55`). **(Sin confirmar)** qué User-Agent manda `fetchSeguro`; si no es reconocible, se le suma uno propio. Si no, la vigilancia avisaría «cambios» falsos;
  - la vista previa. `/l/vista/<token>?variante=B` muestra B sin Pixel (`pagina-publica.ts:704-722`).
- **La variante nunca va en la URL.** `claveDeLanding` borra el query (`lib/landing-url.ts:37-40`) y `normalizarUrl` lo conserva (`lib/landing-paginas.ts:60-61`): el Analyst fundiría A y B, y el mapa las vería como dos páginas.
- **Publicar a mano detiene la prueba.** Hoy `publicar` no sabe de pruebas (`lib/editor-landing/publicar.ts:159-222`). Si `publicado_version` ya no es `version_base`, la prueba se detiene.
- **La variante es una foto dentro de `prueba_variantes`, no otro `landing_doc`.** Un documento aparte contaría para el tope del plan (`frenoDeTope`, `lib/editor-landing/tope-landings-server.ts:17-30`) y respondería 402.
- **hola-mako.com no sirve para la v1.** `/vsl/<slug>` y la raíz son ISR de 5 minutos más `unstable_cache` (`app/vsl/[slug]/page.tsx:20`, `app/page.tsx:17`, `lib/editor-landing/landing-mako.ts:124`). Las pruebas corren en `hola-mako.site/<slug>`.

**Etapa 2: el agente (Landings, migración «pruebas_config»)**
- **Qué observa.** Corre una vez por día, después de `landing-analyst-auto` (`vercel.json:66-67`), y mira:
  - el alcance y los clics por sección, y `clic_vacio`;
  - la profundidad de scroll y los plays no automáticos;
  - la conversión de la página;
  - los hallazgos de severidad alta del Analyst, que ya traen su `arreglo` escrito (`lib/landing-analyst.ts:63-64`);
  - el hook del anuncio ganador del Media Buyer.
- **Qué propone.** Un motor puro `oportunidades()` saca **una sola hipótesis por página**. Por ejemplo: «La sección "Precios" la ve el 18 %: subirla después del testimonio», o «Nadie toca el botón del hero: probar el hook del anuncio que más convierte».
- **Cómo genera la B:**
  - con `editar` (`lib/editor-landing/ia.ts:446`), con alcance de sección y **sobre una copia** del contenido, sin guardar el documento;
  - respetando `bloqueadaIA` (`lib/editor-landing/doc.ts:267`);
  - solo con lo que se puede citar, en español neutro con «tú» y con la IA del negocio.
- **Qué puede cambiar:** el hook (H1 y subtítulo), el texto del botón, el copy de una sección, subir una sección que nadie alcanza (nunca el hero ni el formulario), acortar o fundir.
- **Qué nunca toca:** precio, oferta, garantía, destinos de los links, formularios, botones de pago, Pixel ni Meta (`lib/texto-critico.ts:1-15`).
- **Modos:** apagado (sin fila) / propone (al prenderlo) / piloto. En «propone», cada propuesta trae el porqué con números y la vista previa de B, y vence a las 72 h.
- **Topes fijos en el código:**
  - una prueba por página;
  - B con 50 % como máximo;
  - 7 días de respiro después de aplicar un cambio;
  - ninguna prueba sobre una página publicada en las últimas 48 h;
  - una rama nueva no se corta en sus primeros 7 días (la incubación de Coframe).
- **Aplicar, deshacer y detener:**
  - Aplicar = guardar la versión «Antes de la prueba A/B», escribir el cambio de B en el documento y publicar.
  - Deshacer = restaurar esa versión y publicar, solo si nadie publicó después.
  - Detener = volver a servir solo A al instante.
- **Pantalla.**
  - Botón «Probar» al lado de «Aplicar» en cada hallazgo del Diagnóstico (`app/web-generator/diagnostico/PanelDiagnostico.tsx:815`).
  - La prueba en curso y los ajustes del modo, en «Análisis» (`DialogoAnalitica.tsx`).
  - En la API de MaKo: ver, aprobar y detener.
- **Que las lecturas separen por rama:**
  - el mapa de calor, que hoy agrupa por URL (`app/api/landing-analyst/mapa/route.ts:41-44`); la foto de fondo tiene que salir de una grabación de la misma rama;
  - el Analyst y la analítica del editor;
  - la dimensión «Variante» del Dashboard (`lib/graficos-catalogo.ts:136`), que hoy lee `prueba` y queda siempre vacía (`lib/graficos-datos.ts:119-124`).

**Riesgos.**
- **Volumen:** subir el clic al CTA de 10 % a 13 % pide unas 1.800 personas por rama; el alcance de una sección de 40 % a 50 %, unas 400 (unos 6 días con el tráfico del cliente más grande).
- **Sin landings de clientes:** Web Generator tenía 0 landings de clientes publicadas al 14-15/10 (`docs/hallazgos-editor-landing.md:766`, `:1514`). **(Sin confirmar)** cuántas hay hoy. El agente arranca en las 8 landings del lanzamiento del ws9 (documentos #33 a #40, `docs/relevo/landing-generator.md:69-71`).
- **El Media Buyer no sabe de landings:** un cambio de página mueve el costo por lead de todos los anuncios, así que tiene que enterarse de que hay una prueba corriendo.

### 3.3 Gratis con la tarjeta (Automations)

- **Fijo vs AI Step:** `texto_autor` ya se guarda en cada envío (`lib/nutricion.ts:5523-5524`).
- **Asunto o cuerpo de email:** dos tarjetas EMAIL, una en A y otra en B. Se mide por **clic, no apertura**, porque Apple Mail infla las aperturas. Hoy solo el ws1 tiene remitente propio (`lib/email-remitente.ts:11-14`).
- **Texto vs audio, hora de envío, DELAY corto vs largo, y la apertura de un DM de Instagram** (comentario → DM, `lib/disparadores.ts:151`, `:169`).

### 3.4 Variantes de WhatsApp que ya existen (Automations)

- **Siguen siendo anti-ban, no ramas.**
  - Son el mismo contenido dicho de otra forma (`lib/secuencias-variantes.ts:1-16`).
  - Solo salen por WhatsApp no oficial (`lib/nutricion.ts:5189`).
  - Se editan a mano con el botón «↻» (`app/automations/EditorMensajeWhatsApp.tsx:1230`).
  - **(Sin confirmar)** quién las genera hoy: `action:'variantes'` (`app/api/chat-agent/secuencias/route.ts:508`) no tiene ningún llamador en `app/` según git grep.
- **Lo único que se agrega:**
  - `textoDelPaso` devuelve también el índice de la variante que salió, y se guarda en `nutricion_envios.variante` (migración chica).
  - El id del mensaje de WhatsApp va a `proveedor_id`: `enviarYEspejar` ya lo tiene (`r.id`) y hoy lo descarta (`lib/evolution-envio.ts:63-82`), y `proveedor_id` solo lo llena el email.
  - Métricas muestra las respuestas por variante. Nada de esto decide nada.
- **Dentro de una prueba A/B,** cada rama lleva su propio pool de variantes. `setSecuenciaPasos` conserva las variantes por posición y un `[]` no las borra (`docs/hallazgos-comunicacion.md:1688-1705`), así que al copiar la rama B hay que vaciarlas o regenerarlas. Si no, B sale con variantes del texto viejo.

### 3.5 Portada de hola-mako.com (Landings; arrancarla la decide Martín)

- **Las dos versiones ya existen:** A «el equipo» (`mako-equipo`) y B «todo junto» (`mako-todo-junto`), armadas y sin publicar (`docs/hallazgos-editor-landing.md:2788-2791`). En la variante va `contenido = {doc_id}`.
- **Métrica:** clic a /planes. **Guardrail:** prueba gratis iniciada. Después del registro no hay eventos (`docs/embudo-y-high-ticket.md:403`).
- **Falta:** que la raíz deje de ser ISR, o que el proxy reescriba a `/l/` con la cookie (`proxy.ts:177`, `:235`, `:346`).

### 3.6 Media Buyer: el «Ganador» como prueba (Media Buyer; espera la 0332)

- **Qué se registra:** las variaciones del Ganador (`lib/media-buyer/variaciones.ts`), como una prueba de superficie `anuncios`, madre contra hijas, medida con las agendas del CRM por anuncio.
- **Es una lectura, no un A/B.** La entrega la reparte Meta (`ejecutar.ts:196-209`), y no hay split test ni en `lib/zernio-ads.ts` ni en `lib/meta-write.ts`.
- **Por eso nunca entra como verdad:** va a `experimentos` como `no_concluyente` o `refutada`, nunca `validada`, y el aprendizaje lo aclara.

### 3.7 VSL por Panda (Landing Analyst)

- **El dato de hoy no sirve:** `video_variant` es una copia de `video_id` (`app/api/cron/panda-daily/route.ts:57-58`) y nadie lo lee (`docs/hallazgos-ads.md:186-205`).
- **Cómo funcionaría:**
  1. el dueño declara qué dos videos compiten;
  2. MaKo lee `vsl_events` por `video_id` y `landing_url` (mig 0137);
  3. la retención se pondera por plays.
- **Antes hay que arreglar el promedio de promedios.**
- **(Sin confirmar)** si un embed A/B de Panda deja en `video_id` el id de cada variante o el de la prueba.

### 3.8 Dónde no conviene

- **Recordatorios de reunión:** los manda otro emisor (`lib/recordatorio-automatizacion.ts:9-18`) y la asistencia se marca a mano.
- **Precio u oferta decididos por un agente:** la misma persona vería dos precios desde dos dispositivos, y el cobro va atado al `productoId` (`lib/editor-landing/pago-landing.ts:7-14`). Para eso queda el experimento antes/después.
- **/planes, la prueba gratis, el onboarding y los avisos de MaKo:** se decidieron el 25/10 y hay 4 clientes.
- **Guiones de llamada y de closing:** los dice una persona y hay pocas llamadas.
- **Posts orgánicos** (Meta Organic A/B, YouTube): MaKo no publica posts. Solo responde comentarios (`lib/zernio.ts:373`).
- **Landings externas a través del Pixel.**
- **«Leyó» por WhatsApp como métrica.**

---

## 4. Qué copiamos de quién

| Qué | De quién | URL |
|---|---|---|
| Tarjeta Split con % que suman 100; sticky; un cambio de % solo afecta a los nuevos | GoHighLevel Split | https://help.gohighlevel.com/support/solutions/articles/155000003304 |
| Separar «repartir» de «elegir ganador»; terminar por fecha, por N o por condición | ActiveCampaign Split | https://help.activecampaign.com/hc/en-us/articles/115001957624 |
| Ganador automático + fecha tope; ante empate gana la primera; clic en vez de apertura | Klaviyo, A/B en flows | https://help.klaviyo.com/hc/en-us/articles/6960371049115 |
| Ventana del experimento; editar mientras corre lo termina | Braze Winning Path | https://braze.com/docs/user_guide/engagement_tools/canvas/canvas_components/experiment_step/winning_path |
| Lo que NO se copia: borrar la perdedora y su historial | Customer.io | https://docs.customer.io/messaging/send/workflows/a-b-test-automations.md |
| Informe del mapa de calor por impacto con link a la sección; ganar con 95 % + pérdida esperada; retractar al 90 % | VWO | https://help.wingify.com/hc/en-us/articles/58947875269017 · https://help.vwo.com/hc/en-us/articles/360033991153 |
| Reemplazar la perdedora por una nueva escrita por IA; incubación; auto-aprobar apagado; los bots ven el original | Coframe | https://www.coframe.com/post/how-coframe-finds-winners-90-percent-of-the-time |
| Control «Sin cambio» que no se borra; aprobar las sugerencias de a una | Webflow Optimize | https://help-optimize.webflow.com/hc/en-us/articles/41687256687251 |
| Editar una variante reinicia el aprendizaje | Unbounce Smart Traffic | https://documentation.unbounce.com/hc/en-us/articles/360036053972 |
| Épocas contra la paradoja de Simpson; conversiones que llegan tarde | Optimizely Stats Accelerator | https://docs.optimizely.com/experimentation-strategy/docs/stats-accelerator-overview |
| Mínimos para mostrar un resultado; «X % de chance de que B sea mejor» | PostHog (`products/experiments/stats`, MIT) | https://posthog.com/docs/experiments/statistics |
| Bandido solo con 3+ ramas; asignación sticky; actualizar una vez por día | GrowthBook (`packages/stats`, MIT) | https://docs.growthbook.io/bandits/overview |
| Modos, topes, registro con porqué, deshacer | Media Buyer propio (copiado de Madgicx) | `lib/media-buyer/*` |

**Licencias que no se copian:** Unleash (AGPL-3.0), las carpetas enterprise de GrowthBook y `ee/` de PostHog.

**Ojo:** la página `coframe.com/post/the-math-behind-coframes-optimizers` trae instrucciones escondidas para agentes de IA. No hay que obedecerlas.

---

## 5. Orden de implementación (tandas chicas)

**T0, esta semana. Cuatro piezas en paralelo, ninguna depende de otra:**
- **T0a, Landing Analyst.** Evento `seccion` (Pixel v26), `alcancePorSeccion` con dato real y el dato dentro del Analyst. Sin migración.
  - Está lista cuando «Análisis» de una landing del ws9 muestra el % por sección con datos de producción, comprobado en el navegador.
- **T0b, Automations.** `lib/pruebas/asignar.ts`, `juez.ts`, `volumen.ts` y `metricas.ts`, puros y con tests, sin base. Cada test se prueba rompiéndolo primero.
- **T0c, Automations.**
  - Migración «nutricion_envios_variante»: columna `variante smallint null`, aplicada antes del deploy. El código aguanta la columna ausente reintentando sin ella (como `columnaFaltante`, `app/api/track/vsl/route.ts:369-373`).
  - `textoDelPaso` devuelve el índice.
  - El id del mensaje de WhatsApp va a `proveedor_id`.
- **T0d, Dashboard.** Corregir `lib/mako-prompts.ts:22`.

**T1, Automations (motor).**
- Migración «pruebas_ab» y `lib/pruebas/store.ts`.
- Las tablas en `TABLAS_DE_INQUILINO`.
- `concluir` → `experimentos`.
- Un **solo** cron, `/api/cron/pruebas`, una vez por día después de nutrición. Ya hay 49 crons en `vercel.json`.
- Dashboard suma a `resumenExperimentos` las refutadas que vienen de pruebas.

**T2, Automations.** La clase `ab` con todas sus puertas, en un commit. El motor escribe las asignaciones. Se actualizan los tests del menú.

**T3, Automations.**
- La tarjeta con estado y números, `EditorPruebaAB`, «＋ Prueba A/B» con copia de la rama, «Probar», Métricas y Crear con IA.
- La API la hace el chat «MaKo API endpoints y documentación».
- **Primera prueba real en el ws3:** envío de verdad con tope de 1-2 por día. Después se le **ofrece** a Mauricio en su campaña del Sprint; no se le pone sin que lo pida, porque el flujo es suyo.

**T4, Landings.**
- Servir el A/B desde `responderPublico`.
- `?variante=B` en la vista previa.
- Publicar a mano detiene la prueba.
- «Probar» manual desde un hallazgo del Diagnóstico.
- Primera prueba en una landing del ws9 en hola-mako.site. **Necesita el sí de Martín (M1).**

**T5, Landing Analyst.**
- Los medidores de landing (`clic_conversion`, `alcance_seccion`, `play_manual`) por `visitor_id` ∩ `landing_visits`.
- Separar por rama el mapa de calor, el Analyst y la dimensión «Variante» del Dashboard.

**T6, Landings.**
- Migración «pruebas_config».
- `oportunidades()`, los modos propone y piloto, el historial, deshacer y la API.

**T7.**
- Media Buyer (cuando se aplique la 0332).
- Portada de hola-mako.com (M1).
- VSL por Panda.

---

## 6. Decisiones tomadas (por el Cerebro) y lo que necesita a Martín

**Decisiones:**
1. **Un solo motor** (`lib/pruebas/` y cinco tablas) para todas las superficies. `experimentos` no se estira: mide antes/después, sobre toda la cuenta, y lo cierra un LLM.
2. **Reparto fijo, sticky y guardado. Sin bandido en v1**, por lo que miden GrowthBook y Optimizely, y porque las conclusiones tienen que poder afirmarse.
3. **El juez está en el código**, con Beta-Binomial y prior escéptico. La IA solo redacta el aprendizaje sobre números ya calculados («una regla en un prompt no es una regla», `lib/ai-step-armar.ts:12-13`).
4. **Decide la métrica cercana; la final cuida.** Con 0,2 % de reservas, decidir por agenda no es posible.
5. **Lo que se sirve se separa de lo que es verdad:** el 80 % sirve para quedarse con una rama, solo el 95 % se registra como verdad.
6. **La tarjeta es una clase nueva `ab`, no una condición** (3.1).
7. **El ganador nunca se escribe en `pasos` ni se republica solo.** El dueño quita la tarjeta cuando no queda nadie en las ramas perdedoras.
8. **Unidad:** `lead_id` en automatizaciones, `visitor_id` en landing. La huella siempre va salada con el id de la prueba.
9. **Landing AI solo en páginas que sirve MaKo.** Las externas pasan por «Replicar».
10. **Landing AI apagado por defecto; al prenderlo, «propone»; el piloto lo prende cada negocio.** Topes y lista de lo que puede tocar, escritos en el código. Se prueba primero en el ws9, nunca primero en un cliente.
11. **Las variantes anti-ban se registran pero no deciden.**
12. **Sin holdout permanente en v1.** El control «Sin cambio» no se borra.
13. **Los avisos van al feed.** Por WhatsApp, solo como fila pausada del ws9.
14. **Una prueba viva por lugar y por automatización.**
15. **Los bots, el lector de MaKo, la vigilancia y la vista previa siempre reciben A.**
16. **Un solo cron diario para todas las superficies.**
17. **Editar durante una prueba:** en landing, la detiene; en automatización, abre una época nueva.
18. **La lectura de anuncios del Media Buyer nunca es `validada`.**
19. **Sin dependencias nuevas:** el muestreo de la Beta se escribe en casa.

**Lo que necesita a Martín:**
- **M1. Mostrar en público una versión que escribió la IA en una landing de MaKo.** Es la primera prueba en hola-mako.site y también la portada A/B de hola-mako.com, que además recibe tráfico pago (**sin confirmar** a qué URL apuntan hoy los anuncios). Hasta que diga que sí, las pruebas del ws9 quedan en «propone» y no se arranca ninguna.
- **M2. Aplicar la 0332 y dejar que las variaciones del Media Buyer gasten pauta** (ya estaba pendiente). La superficie 3.6 espera eso.
- **M3. En qué plan va el Landing AI** (es una decisión de plata). Mientras tanto va en todos los planes: escribe con la IA del negocio y a MaKo no le cuesta nada.
- **M4. Hablar con Mauricio.** Su landing es externa (Lovable): probarla pide replicarla en Web Generator, y la prueba en su Sprint toca un flujo suyo. Se le ofrece; no se toca nada sin su sí.

---

## 7. Para cosechar (lo hace el orquestador; este agente solo leyó)

- **`docs/hallazgos-landing.md`:**
  - «`prueba` ≠ variante A/B» (`lib/landing-token.ts:1503-1515`).
  - «`video_variant` = `video_id`» (`app/api/cron/panda-daily/route.ts:57-58`).
  - «`alcancePorSeccion` vuelve null y la pantalla ya lo dibuja».
  - «`ES_EVENTO_DE_VIDEO` incluye `s\d+`: un evento nuevo no puede llamarse `s<n>`».
  - «Reusar la huella de `grabaA` sin sal correlaciona la rama con la grabación».
  - «El comentario de `getComportamiento` es falso desde la 0137».
- **`docs/hallazgos-chatbot.md`:**
  - «El A/B como condición del catálogo era el diseño obvio y equivocado: no se puede pegar a otra condición (`condicion_pegada`), tiene "Si no" y se re-evalúa».
  - «El ganador no va en `pasos`».
- **`docs/hallazgos-graficos.md`:** «La dimensión "Variante" lee `prueba` y siempre queda vacía» (`lib/graficos-catalogo.ts:136`).
- **`docs/hallazgos-ia.md`:** «`lib/mako-prompts.ts:22` manda a una vista retirada».
- **Este diseño** puede ir a `docs/diseno-pruebas-ab.md`.
- **El índice `docs/hallazgos.md`** se actualiza en el mismo commit.
---

# Anexo 2 — La crítica (manda sobre el diseño)


Leí `C:/dev/wt-push-q` en `2ea62638c` sin cambiar nada. Hice dos cuentas en numpy, que no son tests del repo. Los scripts están en `C:\Users\marti\AppData\Local\Temp\claude\C--Users-marti-OneDrive-Escritorio-dashboard-marketing-main\0ee425c6-e397-47f3-945c-412b6db51178\scratchpad\ab.py` y `...\scratchpad\peek2.py`. Lo que no pude confirmar va marcado **(sin confirmar)**.

Lo más grave: el juez, tal como está escrito, declara ganadores y «probado que no funciona» que son falsos en entre el 10 y el 35 % de las pruebas, aunque no haya ninguna diferencia real. Además, dos funciones del motor de WhatsApp dejan de proteger los recordatorios en cuanto hay una tarjeta A/B en el medio.

## A. Estadística: el juez miente con este volumen

1. **Mirar todos los días infla los falsos ganadores, y la regla propuesta no lo frena.**
   - Simulé 20.000 pruebas A/A (sin diferencia real). Usé aproximación normal de la Beta, prior de peso 10, P ≥ 95 % en dos lecturas seguidas desde el día 7 y pérdida < 1 % del control.
   - Automatización, 25 por rama y por día, mínimo 20, 60 días: **17,4 % «gana B» falso y 16,9 % «corta, gana el control» falso**. Si el corte va sin los 7 días ni las dos lecturas, como dice 2.5, el corte falso sube a 25 %.
   - Con mínimo 300 por rama (lo que daría `volumen.ts`): 14,5 % y 16,6 %.
   - Landing, 34 por rama y por día, mínimo 400, 28 días: 10,0 % y 12,1 %.
   - Una sola mirada al llegar a 1.800 por rama: 4,7 % y 0 %.
   - El prior «escéptico» de peso 10 son 10 visitas inventadas por rama. Al lado de cientos de visitas reales no pesa nada.
   - **Arreglo:**
     - El horizonte es fijo: `min_por_rama` es el n que calcula `volumen.ts`, y «gana» solo se decide en esa mirada.
     - Las lecturas de antes solo pueden cortar por daño, con un umbral de 99,5 %.
     - El test del juez tiene que correr una simulación A/A con el calendario real de lecturas y exigir ≤ 5 % de falsos ganadores. Ese test es la puerta de T1.

2. **CORTA termina en «gana el control», eso se guarda como `refutada` y llega a MaKo como «PROBADO QUE NO FUNCIONA».**
   - Pasa en el 17 al 25 % de las pruebas sin diferencia real.
   - Hoy `resumenExperimentos` inyecta lo que lee en el prompt de todo el dashboard como «lo ÚNICO probado con datos» (`lib/experimentos.ts:716-737`).
   - **Arreglo:**
     - Cortar temprano solo deja de servir esa rama. El veredicto queda `no_concluyente`.
     - Una prueba sin potencia nunca entra como «no funciona».
     - `refutada` solo con daño demostrado en el horizonte fijo.

3. **El ejemplo de 2.5 contradice su propia regla.**
   - Con 2/20 contra 8/20 sale P = 0,969, pero la pérdida esperada es 0,00135, más que el umbral de 0,001. Según la regla doble, **no gana**.
   - El intervalo del 90 % del lift es [+10 %, +523 %]. Un aprendizaje que diga «subió de 10 % a 40 %» presenta como verdad un número que no se sabe.
   - **Arreglo:**
     - El aprendizaje cita el intervalo, no el punto.
     - El texto que escribe la IA se valida con `numerosDe` y `respetaElOriginal` (`lib/texto-critico.ts:43`, `:63`) contra los números calculados. Si no pasa, se usa la plantilla.

4. **«DA LO MISMO» con ±10 % relativo nunca se cumple.**
   - Con una tasa del 10 % hacen falta unas 4.900 personas por rama.
   - **Arreglo:** que el umbral sea el efecto mínimo detectable planificado, y que el texto diga «no se vio una diferencia mayor a X», sin hablar de empate.

## B. Métricas que no miden lo que dicen

5. **«Agendó» no tiene hora en que se agendó.**
   - `agendoLead` es un estado: cualquier `fecha_junta_*` o `junta_*_at` no vacío cuenta (`lib/nutricion-grafo-motor.ts:774-777`).
   - `junta_1_at` es la hora de la reunión, no la de la reserva (mig 0070).
   - En la reactivación del Sprint, un lead con una reunión vieja cuenta como éxito apenas entra.
   - **Arreglo:** guardar el estado previo en `prueba_asignaciones` al asignar, y contar solo el paso de falso a verdadero. **(Sin confirmar)** si `lead_audit` guarda la hora del cambio de campo.

6. **«Respondió» sale del estado de la inscripción, y ese estado se reescribe.**
   - Al volver a entrar se reusa la misma inscripción (#789, `lib/nutricion-desenlace.ts:180-190`). El resultado de la primera pasada se pisa.
   - **Arreglo:** congelar el resultado y su hora en la asignación la primera vez que se conoce. Para la hora, usar `desenlace_at`, o `updated_at` si falta, como hace `horasHastaResponder` (`lib/automatizacion-metricas.ts:73-76`).

7. **`alcance_seccion` es tautológico para «subir», «acortar» o «fundir».**
   - Si B sube «Precios», B gana en alcance de «Precios» por construcción.
   - Cambiar el texto de una sección que nadie ve tampoco cambia su alcance: lo deciden las de arriba.
   - **Arreglo:** el alcance queda solo como diagnóstico y guardrail. Decide un evento de conversión por visitante.

8. **`clic_conversion` no es una regla por visitante.**
   - `conversionDeLaPagina` devuelve el **tipo** de conversión de la página, no un evento (`lib/landing-conversion.ts:77-100`).
   - Para `registro` no hay ninguna señal medida.
   - `RE_CHECKOUT` solo reconoce Stripe, Hotmart y Mercado Pago (`:50`), y el pago de Web Generator pasa por `/api/landing-generator/pagar` (`lib/editor-landing/origen-landings.ts:124`). **(Sin confirmar)** qué `detalle` deja ese clic.
   - **Arreglo:** cada prueba congela al crearse la lista exacta de destinos (`href`, selector o tipo de evento) que cuentan, con test.

9. **Carrera en el denominador.**
   - La asignación se escribe después de responder, y el pageview del Pixel puede llegar antes. Con «posteriores a `asignada_at`», la primera visita queda afuera.
   - Además van a convivir visitas de la v25 (sin evento de sección) con las de la v26.
   - **Arreglo:**
     - `asignada_at` = la hora del pedido, pasada explícita, con 1 minuto de tolerancia.
     - El denominador del alcance se toma de `landing_visits` con `sv ≥ 26`.

## C. T0a (el evento `seccion`) no funciona tal como está escrito

10. **Las 8 landings del ws9 no tienen `section.gm-tarjeta#t-…`.**
    - Las secciones de «Diseño editable» salen como `div.gm-libre-seccion[data-seccion=<id>]` (`lib/editor-landing/render.ts:506`) con `display: contents` (`lib/editor-landing/html-editable.ts:104`).
    - Un elemento con `display: contents` no tiene caja, así que el IntersectionObserver nunca lo ve en pantalla.
    - El criterio de aceptación de T0a («Análisis de una landing del ws9 muestra el % por sección») no se puede cumplir.
    - **Arreglo:** observar los hijos de cada `.gm-libre-seccion` y reportar su `data-seccion`. Aceptar con una página de bloques y una de «Diseño editable».

11. **Una sección más alta que dos pantallas nunca llega a «la mitad en pantalla».**
    - **Arreglo:** contarla cuando lo visible ocupa al menos la mitad del elemento **o** la mitad de la pantalla, lo que sea menor.

12. **Volumen de eventos.**
    - Hay un techo documentado: 4 eventos de scroll más el cierre, y clics topeados en 40 («se ve en la factura», `docs/hallazgos-landing.md:552-560`). 30 eventos por visita lo rompen.
    - `getTrackingEvents` aplica `.limit(120)` en la base **antes** de filtrar en JS (`lib/leads.ts:2807-2811`). Con eventos de sección, la ficha del lead pierde sus clics y plays.
    - `getComportamiento` lee todos los `vsl_events` de la ventana, sin filtrar por tipo, cada hora (`lib/landing-analyst.ts:185`).
    - El feed del probador muestra 40 filas (`lib/landing-token.ts:775`).
    - **Arreglo:**
      - Un evento acumulado `secciones` con los ids en `detalle`. El límite es de 300 caracteres (`app/api/track/vsl/route.ts:515`).
      - Se manda solo al cruzar los hitos de scroll que ya existen y al irse.
      - **No** se agrega a `getTrackingEvents`. El diseño dice que es obligatorio y no lo es: es la ficha del lead.
      - Al subir la versión, también `NOVEDADES` y `ganaConLaNueva` (el candado de versión de `docs/hallazgos-landing.md:540-547`).

## D. Automations: puertas que faltan y que ponen en riesgo a los clientes

13. **La tarjeta A/B desactiva sin aviso las guardas visibles de los recordatorios.**
    - `condicionDeArriba` solo reconoce como guarda a un padre directo de clase `condicion` (`lib/nutricion-grafo-motor.ts:449-456`).
    - `minutosAntesDeReunion` solo sube por padres `condicion` (`:408-440`).
    - Con una tarjeta A/B entre «Su reunión sigue en pie» (o «Esperar 24 h antes de la reunión») y el mensaje, la condición no se vuelve a evaluar y el mensaje deja de tratarse como recordatorio. Puede salir «Mañana es tu reunión» para una reunión cancelada.
    - `condicionesDetras` se detiene en todo lo que no es espera (`lib/flujo-forma.ts:115-117`), así que CONDITION → A/B → CONDITION se podría guardar.
    - **Arreglo:** las dos funciones suben también por `ab`, y la regla de forma trata `ab` como transparente. Los tests se prueban rompiéndolos primero.

14. **Las puertas no son 20, son unas 70.**
    - `=== 'condicion'` aparece unas 70 veces en 20 archivos, contado con `git grep -c`. Por ejemplo: `lib/flujo-ia.ts` (11), `lib/flujo-edicion.ts` (4), `lib/nutricion-hilos.ts`, `lib/equipo-contesto.ts`, `lib/automatizaciones-del-lead-reglas.ts`, `app/automations/PanelProbar.tsx`.
    - Hay escritores de `pasos` fuera de `setSecuenciaPasos` (`docs/hallazgos-chatbot.md:160-169`) y la copia de un flujo a otro negocio (`lib/flujo-copia-negocio.ts:160`).
    - **Arreglo:** un helper `esBifurcacion()`, la lista de los 70 lugares revisados en el commit, y un test por escritor que confirme que `ramas[].pct` sobrevive.

15. **Falta definir qué hace una tarjeta sin prueba.**
    - Pasa en un flujo copiado a otro negocio o desde una plantilla, con la migración ausente, con la prueba descartada o con un error al leer.
    - **Arreglo:**
      - Sin prueba corriendo, todo va a A y la tarjeta lo dice.
      - Si la lectura falla, se reintenta como con `faltan_hechos`. Nunca un sorteo sin registro.
      - `setSecuenciaPasos` rechaza `ab` hasta que esta regla exista.

16. **Copiar «el camino» entero a B duplica el resto del flujo.**
    - El tope es de 60 tarjetas por automatización (`TOPE_NODOS`, `lib/flujo-grafo.ts:1117`).
    - Desde la sexta tanda una tarjeta puede tener varios padres (`:50-52`).
    - **Arreglo:** B copia solo las tarjetas que se prueban y las dos ramas se vuelven a juntar en el resto del flujo. La firma de la rama son las tarjetas entre su salida y ese punto de unión.

17. **Las variantes anti-ban: la rama B queda más expuesta que A.**
    - Con las variantes vaciadas, B le manda el mismo texto exacto a todos.
    - Hoy nadie las puede regenerar: `generarVariantes` solo se llama desde `action:'variantes'` (`app/api/chat-agent/secuencias/route.ts:508-516`), y esa acción no tiene ningún llamador (`git grep` sin resultados).
    - **Arreglo:** las dos ramas con la misma cantidad de variantes (o las dos sin ninguna), y un llamador real antes de T3.

18. **T0c (columna `variante`) puede romper el tope anti-ban.**
    - El insert principal de `nutricion_envios` **ignora el error** (`lib/nutricion.ts:5498`).
    - El presupuesto de 24 h de WhatsApp cuenta esas filas (`enviosUltimas24h`, `:2928-2936`, usado en `:3960`).
    - Si la columna falta en producción, la fila no se guarda sin que nadie se entere, el mensaje sale sin contarse y la línea pasa su tope.
    - Además «nada de esto decide nada».
    - **Arreglo:** no hacer la migración. La variante se saca comparando `texto_enviado`, que ya se guarda (`:5523`), contra las variantes. Revisar el error de ese insert es un arreglo que hace falta igual.

19. **El guardrail «baja o bloqueo» por WhatsApp no existe.**
    - `wa_bloqueados` es el bloqueo que pone el negocio, y Evolution no expone si un contacto nos bloqueó (mig 0075:7-9).
    - **Arreglo:** el guardrail es la tasa de no entregados por rama (`wa_mensajes.status`, que necesita el id del mensaje) más los envíos en `fallo`, con un freno a nivel línea.

20. **«Fijo vs AI Step» mezcla dos cosas distintas.**
    - El AI Step es un «Si responde» con `paso_ia` (`lib/flujo-grafo.ts:506`). No corre en la salida (`lib/nutricion-grafo-motor.ts:238`) y solo puede haber uno por medio (`ai_step_de_mas`, `lib/flujo-forma.ts:160`).
    - Lo que `texto_autor` permite comparar es un mensaje en modo IA contra uno fijo.
    - **La superficie que más mueve «agendó» (el setter) queda afuera por construcción.**
    - **Arreglo:** llamarlo «mensaje IA vs fijo». Probar el setter es otro diseño: sortear al momento de la respuesta, con dos configuraciones dentro de un mismo AI Step.

21. **El volumen está sobreestimado.**
    - «50 por día» es el plan del 22/10 para pasar leads a un CRM (`docs/hallazgos-crm.md:10972-10973`), no envíos medidos.
    - El cupo es de 40 por día y por línea, y se comparte con lo que entra.
    - **Arreglo:** medirlo antes de T3, y que `volumen.ts` use el cupo, no la base de leads.

## E. Servir la landing: riesgos para los clientes

22. **Las rutas laterales leen la foto de A.**
    - `/l/html/[docId]/[bloque]` lee `landing_docs.publicado.htmlLibre` (`app/l/html/[docId]/[bloque]/route.ts:54-59`).
    - El pago valida contra `publicado.pagos` (`lib/editor-landing/pago-landing.ts:125-129`).
    - **Arreglo:** un test que exija que B tenga los mismos `pagos`, `htmlLibre`, formularios, `href`, título y descripción de página (`publicar.ts:124`) que A. Si no, se rechaza.

23. **«Aplicar» publicaría el borrador del dueño.**
    - `publicar` publica el contenido de la fila en su versión actual (`lib/editor-landing/publicar.ts:166-197`). Si el dueño tiene cambios sin publicar, salen junto con B.
    - **Arreglo:** aplicar solo si `version == publicado_version`. Si hay borrador pendiente, se propone y se para.

24. **Las guardas que se citan no están conectadas.**
    - `texto-critico` no se usa ni en `lib/editor-landing` ni en `lib/media-buyer` (`git grep` sin resultados).
    - Además solo cuida placeholders, links y números. No cuida oferta, garantía, formularios ni el Pixel.
    - **Arreglo:** después de `editar`, pasar `respetaElOriginal` sección por sección y comparar la estructura (links, formularios, botones de pago).

25. **Decidir la rama de los bots por User-Agent.**
    - Google pide no hacerlo: lo considera cloaking (conocimiento general, no lo verifiqué hoy).
    - Con Meta, el anuncio se aprueba mirando A y la gente ve B.
    - **Arreglo:**
      - Sin regla por User-Agent para terceros. Igual quedan fuera del denominador porque no corren el Pixel.
      - Solo el lector de MaKo, la vigilancia y la vista previa van fijos a A.
      - En modo piloto, solo cambios de estructura. Los cambios de texto siempre con aprobación.

26. **Safari corta la persistencia de la rama a los 7 días.**
    - El Pixel reescribe la cookie desde JS en cada visita (`lib/landing-token.ts:1498-1499`), y Safari limita esas cookies a 7 días (conocimiento general).
    - **Arreglo:** una cookie aparte `mko_ab_<prueba>`, HttpOnly, que pone el servidor y renueva en cada respuesta.

27. **Una lectura extra de la base en cada visita** para saber si hay prueba.
    - **Arreglo:** una marca en la misma fila que ya lee `leerPublicado`.

28. **Puede no haber tráfico donde se va a probar.**
    - Las 8 landings se sirven también en hola-mako.com/vsl/<slug>, que tiene caché (`docs/relevo/landing-generator.md:69-71`).
    - **Arreglo:** medir `landing_visits` por host para los documentos #33 a #40 antes de T4.

## F. Afirmaciones falsas o que se contradicen

29. **«El mapa de calor de B saldría vacío» es falso.**
    - El muestreo de grabaciones es 100 por defecto (`lib/replay-contrato.ts:504`, `:562`).
    - Los clics del mapa salen de `vsl_events` (`lib/landing-mapa-server.ts:98`). Solo la foto de fondo sale de una grabación (`:277`).
    - La sal sigue siendo necesaria por las pruebas simultáneas, pero el motivo que da el diseño no es ese.

30. **3.6 y 3.7 contra 2.7.**
    - Las lecturas no aleatorias de anuncios y de Panda terminarían como `refutada`, y 2.7 manda a MaKo como «PROBADO QUE NO FUNCIONA» las `refutada` con `prueba_id`.
    - **Arreglo:** esas lecturas no entran en `pruebas` ni en `experimentos` como `refutada`.

31. **`fmtVal` dibuja mal la métrica de la prueba (confirmado).**
    - `ab:*` no está en `METRICA_FMT`, cae en 'num' y `Math.round(0.09)` da 0 (`lib/experimentos-formato.ts:18-30`).
    - La pantalla dice «antes / ahora» (`app/dashboard/ElementoExperimento.tsx:118`).
    - **Arreglo:** guardar en %, formatear por el prefijo `ab:` y rotular «A / B».

32. **Detalles menores.**
    - `landing-analyst-auto` corre cada hora (`vercel.json:66-67`, `20 * * * *`): «después de» no ordena nada.
    - `textoDelPaso` se usa en varios lugares: cambiar lo que devuelve tiene efecto en todos.

## G. Orden de implementación

33. **T4 sirve la prueba de landing, pero sus medidores llegan recién en T5.** La prueba corre a ciegas, y con lecturas estrictas cada corrida queda fallida.
    - **Arreglo:** `clic_conversion` va dentro de T4.
34. **T0a no se puede aceptar** con el selector propuesto (punto 10).
35. **T2 agrega `ab` a `NODOS`.** La API de MaKo o los scripts podrían crear la tarjeta antes de T3 y de la regla del punto 15.
    - **Arreglo:** esa regla entra en T2.
36. **T1 arranca el cron y suma las refutadas a MaKo** antes de que el juez esté calibrado.
    - **Arreglo:** el test A/A de T0b es la puerta de T1.
37. **Sacar T0c** (punto 18).

## H. Superficies

- **Falta:** el setter (AI Step), que es lo que mueve «agendó» (punto 20).
- **No valen como `pruebas`:** 3.4, 3.6 y 3.7, porque nada de eso es aleatorio ni decide.
- **3.5 (portada de hola-mako.com):** hace dinámica la página raíz (`app/page.tsx:17`). Va solo con M1 y con el tráfico medido.
- **3.3 (asunto de email):** hoy no tiene a quién servirle, porque solo el ws1 tiene remitente propio.

## Para cosechar (orquestador)

- **`docs/hallazgos-pruebas.md` (área nueva, `lib/pruebas/`):** los números A/A y la regla del horizonte fijo.
- **`docs/hallazgos-chatbot.md`:**
  - `condicionDeArriba` y `minutosAntesDeReunion` solo suben por `condicion`.
  - El insert de envíos ignora su error y el anti-ban cuenta esas filas.
  - El AI Step no se puede probar con la tarjeta.
- **`docs/hallazgos-landing.md`:**
  - El observador no ve los elementos con `display: contents`.
  - El techo de eventos por visita.
- **`docs/hallazgos-editor-landing.md`:**
  - Las rutas laterales leen la foto de A.
  - `publicar` publica el borrador.
- **Dashboard (área `app/dashboard/`):** `fmtVal` con métricas `ab:`.