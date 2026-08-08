# Transform app from Thinker to Doer mode

`2026-07-09 03:26` → `2026-07-09 04:06` · 3 mensajes de Martín · 6 respuestas de Claude · sesión `8c0178e3`

> Transcripción de la conversación. **No incluye las llamadas a herramientas ni sus resultados** —son el 96% del peso y no son la charla— ni el razonamiento interno de Claude. Las credenciales que aparecían en el texto están **redactadas**; el resumen de qué se hizo en cada sesión está en [chats.md](chats.md).

---

## Martín

`2026-07-09 03:26`

Quiero que analices toda mi app para detectar como podría hacerla más "Doer", ya que hoy está muy "Thinker"...

Entendiendo para quien está construida la app, para el que corre VSL Funnel, normalmente un infoproductor que si, aprecia los datos, pero hoy en día la app es abrumadora.
Ellos están acostumbrados a ejecutar, más que a detenerse eternamente a analizar la cantidad de gráficos, es probable que como está hoy la app, no usen el 80% de funcionalidades. NO porque no estén buenas o porque no sirvan, sino, porque es mucho.

¿Cómo se me ocurre que la app podría ser más "doer", es decir, más simple?
Bueno:

1. Podríamos tener en configuraciones un botón de "Encender modo Avanzado", que muestre todas las tabs con todos los gráficos tal cual como está ahora. Pero que por defecto, venga en modo simple.
2. En lugar de tener tantas tabs de análisis y tantos gráficos, podríamos elegir los principales, reducir el número de tabs y que en lugar de mostrar muchos gráficos, se muestre la "conclusión" o el "insigth", por ejemplo, que corra un prompt para toda la tab de closing analyst, en donde me de los principales aprendizajes o cosas a mejorar. Lo mismo para la tab de comercial, marketing, script analyst, etc...
3. Podríamos identificar qué cosas hoy en día dependen de que el usuario le de a ejecutar, y que se ejecuten automáticamente... Por ejemplo, el apartado de "Retro", que se ejecute cada X cantidad de tiempo, y así con todo. Que sea más simple.
4. Yo siento que le di mucha mucha prioridad a las funcionalidades de gráficos y análisis, pero no tanta a las funcionalidades prácticas... Como por ejemplo "El semáforo", que hoy podría mejorarse mucho, conectarse a la Retro, por ejemplo, que te envié notif de Whatsapp avisandote las urgencias, etc... O como por ejemplo la funcionalidad de "Crear nueva campaña", que podría conectarse con toda la retro y experimentos, y que te sugiera que campaña crear según lo que le conviene a tu negocio... En fin, podríamos identificar todas las funcionalidades "doer" y las oportunidades de mejora que tienen con todo lo que tenemos, o incluso con cosas que no tenemos y podríamos desarrollar, eso no hay problema.
5.  Sería bueno terminar todas las funcionalidades pendientes que justamente son de "doer", como por ejemplo, la nutrición automática, o como la funcionalidad de Email Marketing... Esas y otras, son las que le dan a la app la sensación de ser práctica, no simplemente analítica.
6. Podríamos mejorar enormemente las funcionalidades "doer" que hay hoy en día. Como por ejemplo los Experiments y las Retro... De la siguiente manera:
Puedo mejorar ampliamente la tab de experiments...
- Por ejemplo, detectar si se está escalando campañas incorrectamente.
- Detectar si de por si hay una estrategia de escalado y otra de testeo, o más bien es todo al azar.
- Detectar si estamos gastando más sin tener mayores resultados comparando a meses anteriores.
- Detectar si FALTA algo en el funnel, las personas muchas veces no NUTREN, no hacen recordatorios, etc...
- Detectar el tipo de ads que se hacen, si son siempre los mismos con pocas variaciones o si realmente se están haciendo bien las campañas de testeo.
- Detectar la QUEMA de dinero, intentando escalar ads NO ganadores. (Definir la métrica de un ad ganador)
- Que Experiments corra solo, por semana o por mes.

Bueno, con todas estas ideas y las que se te ocurran (No te limites, yo te di mis ideas, pero me interesa tu razonamiento...) Quiero que me des tu perspectiva y que propongamos los cambios.

### Claude

Buena consigna. Antes de opinar quiero mapear la app real —qué tabs hay, qué es gráfico vs. qué es acción, qué corre solo vs. qué depende de un botón— para que la propuesta salga del código y no de memoria. Hago un scouting rápido y después lanzo un barrido en paralelo.

### Claude

Sigo esperando el resultado del barrido — te aviso apenas tenga el inventario completo y ahí armo la propuesta con mi perspectiva.


---

## Martín

`2026-07-09 03:37`

¿Pasó algo? Continuas?

### Claude

Sí, sigo acá — dejame chequear cómo va el barrido.

### Claude

Listo. Auditamos toda la app con 7 agentes en paralelo (320 lecturas de código, todo verificado con archivo y línea). Acá va mi diagnóstico y la propuesta.

---

## El diagnóstico en una frase

**Tu app no tiene un problema de falta de funcionalidades doer — tiene un problema de funcionalidades doer apagadas, huérfanas o que terminan en un link.** El "Thinker" no es lo que sobra: es lo único que quedó visible.

Lo que encontró la auditoría, en tres patrones:

**1. Doer construido pero apagado por flags.** Los 3 crons que "actúan sobre el mundo" ya corren cada hora en Vercel, pero en simulacro: la nutrición automática (`NUTRICION_SEND_ENABLED`), el CRM automático que mueve leads solo (`CRM_AUTO_ENABLED`) y los broadcasts de email (`EMAIL_SEND_ENABLED`). Ir a "doer" acá no es desarrollar: es encender con cuidado.

**2. Doer construido pero huérfano.** Esto me sorprendió:
- `/api/experimentos/ideas` — MaKo mirando tu funnel real y proponiendo experimentos solo — **está terminado en backend y ningún botón, componente ni cron lo llama**. El "doer proactivo" que pedís en tu punto 6 ya existe, sin enchufar.
- El chat general de MaKo (`/mako`) responde **sin ningún número vivo del negocio**: te sugiere preguntarle "¿cómo viene el negocio este mes?" pero el system prompt no recibe funnel, spend ni leads. La función que lo arreglaría (`snapshotFunnelTexto()`) existe y se usa en experimentos — son ~5 líneas enchufarla.
- Tu idea de "el semáforo que te manda WhatsApp con urgencias" **ya existe a medias**: el cron `reporte-horario` corre cada hora, arma urgencias (cuenta Meta en rojo, cuotas vencidas, fatiga de adsets, datos sin marcar) y solo te escribe si hay algo. Lo que falta es unificarlo con el semáforo de /general y hacer las alertas accionables.

**3. Análisis que termina en un link en vez de una acción.** El semáforo detecta "este adset está fatigado" y te manda... a otra tab. Con las escrituras a Meta ya funcionando (pausar, presupuesto, crear campañas), el paso que falta es corto: que la alerta traiga el botón.

Y el dato que explica la sensación de "abrumadora": de ~25 entradas del sidebar, **10 son "Coming Soon"** (Offer/Landing/VSL/Market Analyst, los 4 Writers, Instagram, CS Analyst — stubs de 7 líneas). Casi la mitad del menú es promesa, no producto.

---

## Tu ideas, contrastadas con el código

**1. Modo Avanzado en configuraciones** — De acuerdo, y es barato (la infra de settings por workspace y `guardTab` ya existen). Pero solo esconder gráficos no vuelve la app doer; el modo simple necesita una *home distinta* (ver propuesta), no la misma home con menos cosas. También el modo simple debería sacar los 10 Coming Soon del nav.

**2. Conclusión/insight por tab en vez de gráficos** — Acá hay una muy buena noticia: **el 80% está construido y probado en producción, adentro de la Retro**. `retro-fuentes.ts` ya genera resúmenes deterministas por área (adquisición, nutrición, conversión, creativos, revenue, experimentos) con números reales; el prompt `RETRO3_AREA_SYSTEM` ya produce "1-3 hallazgos con evidencia numérica" y hay un verificador anti-alucinación. Lo que falta es un endpoint genérico + una tabla `tab_insights` con caché, y **precomputarlo por cron después de la ingesta diaria** (no al abrir la tab: cada corrida es Opus a alto esfuerzo, 15-60 segundos y centavos-a-dólares — generado a demanda sería lento y caro; generado una vez al día, es imperceptible).

**3. Automatizar lo que hoy es botón** — El inventario dio esto:
- **Ya automatizado (botón redundante)**: Closing Analyst y Script Analyst tienen cron diario idéntico al botón "Sincronizar". Se pueden esconder los botones en modo simple sin perder nada.
- **Automatizable sin riesgo**: cierre de experimentos vencidos (la medición es determinística, la IA solo redacta el veredicto — hoy espera tu click eternamente), Retro semanal automática (el endpoint es puro server; es la operación más cara de la app, pero 1×/semana es razonable), insights del lead auto-generados cuando el cron termina de analizar su llamada, y **la extracción histórica del onboarding, que hoy depende de que el cliente deje la pestaña abierta** (si la cierra, se congela — eso es directamente un bug de producto para el multi-tenant).
- **Manual por naturaleza (no tocar)**: re-análisis con feedback humano, valorar guiones, redactar copys, publicar campañas.

**4. Priorizar lo práctico sobre lo analítico** — Coincido y el código te da la razón: la tab más pulida de la app (Closing, 9 gráficos) es 100% lectura, mientras el semáforo — lo más doer-conclusivo — no tiene ni IA ni acciones. Lo de "Nueva campaña conectada a Retro y Experimentos" es viable ya: las verdades validadas de experimentos **ya se inyectan al prompt de MaKo** en todo el dashboard; falta que `campaign-suggest` reciba también los veredictos Recon (qué ángulos/ads validaron) y el plan de la última Retro.

**5. Terminar los pendientes doer** — Sí, pero con dos alertas del código que tenés que saber antes de encender nada:
- **Riesgo de go-live cruzado**: prender `EMAIL_SEND_ENABLED` solo también hace que el cron de nutrición commitee, y los pasos de WhatsApp se "queman" como simulados sin mandarse (`lib/nutricion.ts:640`). Hay que arreglar eso antes de encender un canal solo.
- **Los flags son globales por deploy, no por workspace**: prender nutrición la prende para todos tus clientes a la vez. Para multi-tenant necesitás flags por workspace primero.
- Además: el recordatorio de juntas **vive en n8n y la app no puede verlo** (está explícito en `nutricion-templates.ts:11`) — es el hueco más caro del funnel (no-shows) y hoy es invisible. Y falta CAPI Purchase al registrar pago.

**6. Detectores de Experiments** — Los bajé a tierra uno por uno. La sorpresa: **ya existe una definición formal de "ad ganador" en el código** (`ReconVeredicto`: validada = ≥10 leads + el adset gastando ≥99% de su techo 3 días seguidos; "apagar" = $80 sin leads; "falso_positivo" = leads sin ritmo → replicar, no escalar). Estado por detector:

| Detector | Dato | Falta |
|---|---|---|
| Gasto ↑ sin resultados vs meses previos | ✅ `calcularDestacados` ya computa delta % vs período anterior | Solo la regla programada + notificación |
| Quema escalando no-ganadores | ✅ veredicto por ad + snapshot diario de presupuestos | Persistir histórico de veredictos + cruce "subió budget × era no-ganador" |
| Poca variedad de creativos | ✅ ángulos/avatares por ad (Script Analyst) + concentración de spend | Computar "N activos / top-2 lleva X% / distribución de ángulos" |
| Huecos del funnel (no nutren, no recuerdan) | ✅ leads sin agenda + cobertura de la Retro + T2 del CRM auto | Recordatorio de juntas (hoy en n8n, invisible) |
| Escalado incorrecto | ✅ `adset_budget_daily` (snapshot diario) | La regla budget(t) vs budget(t−1) no existe |
| Testeo al azar vs estrategia | ✅ tabla experimentos + ángulos por ad | Vínculo ad↔experimento (hoy no existe) |

La clave: **los 6 detectores son mayormente reglas de código, no IA** — los insumos ya existen como funciones puras. Lo que falta transversalmente es un runner programado + persistencia de alertas, y la infra de notificación ya está. Una limitación real a resolver: los experimentos hoy solo miden **métricas globales del funnel** (catálogo de 17), nunca un ad o campaña específica — "cambié el hook del ad X" se mide contra el CPL global contaminado por todo lo demás.

---

## Mi propuesta: 4 fases

**Fase 0 — Enchufar lo que ya existe (días, casi sin riesgo)**
1. Darle números vivos al chat de MaKo (`snapshotFunnelTexto` al system prompt).
2. Enchufar `/api/experimentos/ideas`: cron semanal → notificación "MaKo te propone 3 experimentos".
3. Auto-cierre de experimentos vencidos (cron) + Retro semanal automática opcional.
4. Cron drain para la extracción del onboarding (sacarla del navegador del cliente).
5. Higiene: sacar/agrupar los 10 Coming Soon del nav, borrar `/koncke`, esconder botones "Sincronizar" redundantes, persistir la recomendación del WhatsApp Advisor (hoy se pierde al refrescar y se re-paga).
6. Preparar el go-live seguro de nutrición: fix del bug "canal apagado quema pasos" + flags por workspace en vez de env global.

**Fase 1 — Modo Simple por defecto (la parte visible)**
La home del modo simple no es /general con menos gráficos: es una vista **"Hoy"** con tres bloques — *Semáforo* (qué está mal), *3 acciones sugeridas* (qué hacer, con botón), *1 conclusión por área* (el motor tab-insights precomputado tras la ingesta diaria, reusando las piezas de la Retro). Sidebar simple: Hoy, CRM, WhatsApp, Ads Manager, MaKo. Todo lo demás vive detrás del toggle "Modo avanzado" en /configuraciones (por workspace). El infoproductor abre la app y en 30 segundos sabe qué hacer hoy; el que quiere los 14 gráficos de /comercial, los prende.

**Fase 2 — Detectores + alertas accionables (el corazón doer)**
Un runner (cron diario post-ingesta) que corre los 6 detectores como reglas de código, persiste alertas en una tabla, y cada alerta llega con acción de 1 click: "Este ad quemó $140 sin leads → **Pausar**" (usa `meta-write` que ya funciona + el patrón apply-then-confirm de `mako_confirmaciones` que ya existe). Notificación por WhatsApp reusando `reporte-horario`. Acá también: persistir histórico de veredictos Recon y conectar "Nueva campaña" con verdades de experimentos + veredictos.

**Fase 3 — Tool-use core**
Hoy MaKo tiene literalmente cero tool-use (verificado por grep: todos los "MaKo hace X" son pipelines dedicados). El salto final es que del chat salgan acciones ("pausá los ads que están quemando") con confirmación humana. Es lo más potente y lo más delicado — por eso va última, cuando las Fases 0-2 ya normalizaron el patrón acción-con-confirmación.

**Por dónde empezaría yo: Fase 0 esta semana** — es la mejor relación esfuerzo/impacto que vi en el inventario, y varias cosas (ideas huérfanas, extracción en el navegador, MaKo sin datos) son directamente deuda que ya pagaste y no estás cobrando. Después la Fase 1, que es la que cambia la percepción de tus usuarios.

Guardé todo el diagnóstico en memoria. Si querés, arranco con la Fase 0 ahora — o si preferís, primero armamos juntos el detalle de la vista "Hoy" antes de tocar código.


---

## Martín

`2026-07-09 04:03`

También se me ocurrió, en lugar de dejar "libre" la creación de nuevas campañas y la modificación de las existentes:

1. Proponer un esquema donde te pida un presupuesto total mensual
2. Trabajar ese presupuesto dividiendolo en 2: Para las campañas ganadores y para las campañas de testeo
3. Basarnos en la metodología de Jan, de Ads RECON (Creo que la tienes, sino, te la paso)
4. Si la Retro te dice que nunca testeas campañas, sugerirte invertir X cantidad testeado
5. Si la Retro detecta escalado vertical, sugerir multiplicar presupuesto
6. Si detecta escalado horizontal, sugerir encontrar nuevos avatares para crear más campañas para el escalado horizontal
7. Si salimos con una campaña de testeo, determinar siempre los parámetros del testeo, y a las 24-48 hs ya dar feedback y sugerir apagar, seguir invirtiendo, si hay o no hay ads ganadores, etc...

Básicamente, un guia. Todo esto para agregar a tu análisis.
Y tengo la sensación de que en tu propuesta de 4 fases, no agregaste absolutamente todo, no?
Es por alguna razón? algo que consideres innecesario?

### Claude

Buenas dos preguntas. La segunda es la importante, así que te la voy a contestar de frente: sí, dejé cosas afuera, y a propósito. Pero antes déjame aterrizar tu idea del presupuesto contra el código, porque cambia el orden de prioridades.

### Claude

Ya lo tengo claro. Verifiqué en el código cómo está armado hoy el creador de campañas y la metodología de Jan, y tu idea encaja mejor de lo que esperaba. Te contesto las dos cosas.

## Tu idea del presupuesto: es la mejor de todas, y ya tenés media base

Primero lo importante: **la metodología de Jan ya está en el código, literal.** No me la tenés que pasar. Está en dos lugares:
- `ReconVeredicto` (la definición de "ad ganador": ≥10 leads de intención **+ ritmo**, o sea que el conjunto gaste ≥99% de su presupuesto 3 días seguidos; "apagar" tras $80 sin leads; "intención sin ritmo = falso positivo → snowball, no vertical").
- `CAMPAIGN_METODOLOGIA` en `campaign-structurer.ts:26` — el texto que MaKo ya usa al proponer campañas, que dice *exactamente* lo que vos describís: validar por intención + ritmo, replicar el ganador antes que inventar, empezar simple, apagar tras ~$80/4 días.

Lo que **no existe** hoy y es tu aporte nuevo: **no hay ningún concepto de presupuesto mensual, ni de reparto ganadoras/testeo, ni de guía de escalado.** La creación de campañas es "libre" y one-shot, tal cual dijiste. MaKo estructura *una* campaña bien, pero nadie te dice *cómo repartir la plata del mes* ni te sigue el testeo a las 48h.

Mi veredicto: **esto no es una feature, es el pilar que le faltaba a toda la tesis Doer.** Es la respuesta a la única pregunta que un infoproductor se hace de verdad todos los meses — *"¿dónde pongo la plata?"* — y unifica tres cosas que hoy viven separadas: Recon (veredicto por ad), Experimentos (hipótesis) y el creador de campañas (la acción). Lo llamaría **"El Estratega" / Plan de Medios**.

Cómo lo mapeo contra el código, punto por punto tuyo:

| Tu paso | Estado real | Qué falta |
|---|---|---|
| 1. Pedir presupuesto mensual | No existe | Input + tabla nueva `plan_medios` |
| 2. Split ganadoras/testeo | No existe | Regla de reparto (ver abajo) |
| 3. Basarse en RECON de Jan | ✅ ya en código (`ReconVeredicto` + `CAMPAIGN_METODOLOGIA`) | nada |
| 4. "Nunca testeás → invertí X en testeo" | ✅ la Retro ya detecta cobertura/huecos | Conectar señal → sugerencia de $ |
| 5. Escalado vertical → multiplicar | Falta la regla `budget(t) vs budget(t-1)` (el snapshot diario `adset_budget_daily` ya existe) | La regla + el disparador |
| 6. Escalado horizontal → nuevos avatares | ✅ ángulos/avatares por ad (Script Analyst) + `campaign-suggest` reusa ganadores | Conectar "replicá el ganador con avatar nuevo" |
| 7. Feedback del testeo a 24-48h | Recon es por-ad pero su veredicto duro pide $80/4 días | Lectura *provisional* a 24-48h + gate duro al día 4 |

Una honestidad técnica sobre el punto 7: a las 24-48h **casi nunca tenés certeza estadística**. El coach ahí debe dar una lectura *provisional* (leads hasta ahora, ritmo de gasto, "va encaminado / va lento") y marcar el veredicto **duro** recién en el gate de Jan ($80 / 4 días). Si te vendo "apagá o escalá a las 24h" te estoy mintiendo — y matás ganadores por impaciencia. Y el split ganadoras/testeo **no debería ser dogmático** (70/30 fijo): un negocio sin un solo ad validado debería ir casi todo a testeo; uno con 2 ganadores probados, casi todo a escalar. El ratio se deriva de cuántas `validada` tenés en Recon.

## ¿Dejé cosas afuera? Sí, a propósito — pero en dos me equivoqué

Mis 4 fases fueron una **columna vertebral ordenada por esfuerzo×impacto**, no el backlog completo. Comprimí a propósito: una lista de 30 items es *exactamente* el problema "abrumador" que queremos resolver, aplicado al roadmap. Pero comprimir tiene un costo, y en **dos cosas me quedé corto** y las corrijo:

1. **Recordatorio de juntas / no-shows.** Lo mencioné al pasar y lo subestimé. Hoy **vive en n8n y la app no lo puede ni ver** (está explícito en `nutricion-templates.ts:11`). El no-show es plata pura perdida, y es el hueco más caro del funnel. Debería ser prioridad alta, no una nota.
2. **Cobranza automática.** `pagos.ts` hoy solo se *lee* en los reportes — nadie cobra ni recuerda cuotas solo. Es "doer de plata directa" y ni figuraba.

Y hay un **bloqueante que subestimé**: todos los reportes, crons de acción y flags son **mono-dueño (workspace 1)** y los flags son **globales por deploy, no por workspace**. Si tenés clientes, "encender la nutrición" hoy la enciende para todos a la vez, y ningún cliente recibe reportes. Antes de encender nada en serio, esto se arregla.

Acá está el **ledger completo**, sin esconder nada, agrupado por para qué sirve:

**🟢 Doer de plata (mueven ingresos — máxima prioridad)**
- El Estratega / Plan de Medios (tu idea) ← nuevo pilar
- Recordatorio de juntas / anti no-show (traer de n8n a la app)
- Cobranza automática (recordatorio de cuotas)
- CAPI Purchase al registrar pago (alimenta el algoritmo de Meta)
- Detectores + alertas accionables 1-click (los 6 de Experiments)
- Encender nutrición automática (con el fix del bug de canales)

**🔵 Doer de simplicidad (bajan el "abrumador")**
- Modo Simple por defecto + home "Hoy" (semáforo + 3 acciones + 1 conclusión/área)
- Motor "conclusión por tab" precomputado tras la ingesta diaria
- MaKo con números vivos del negocio
- Enchufar `/api/experimentos/ideas` (huérfano) + auto-cierre de experimentos
- Toggle Modo Avanzado por workspace

**⚪ Higiene (deuda ya pagada sin cobrar)**
- Cron drain de la extracción del onboarding (sacarla del navegador del cliente)
- Persistir recomendación del WhatsApp Advisor + veredictos Recon históricos
- Limpiar los 10 Coming Soon del nav, borrar `/koncke`, código muerto
- Trackear costo de OpenAI, cablear "modos del consultor" y fases vacías
- Multi-tenant: flags por workspace + reportes por cliente

**🔴 Lo que yo NO construiría ahora (tu pregunta "algo innecesario")**
- **Los 4 Writers** (ads/vsl/landing/dm) — son herramientas de contenido tipo "Thinker": no tocan el loop de la plata. Los dejaría como están o los sacaría del nav; no invertiría ahí ahora.
- **Market Analyst / Offer Analyst / CS Analyst** — mismo caso, análisis que no acciona.
- **Motor de experimentos por segmento/ad genérico** — es un pozo. Solo construiría la rebanada angosta que el Estratega necesita (feedback de campaña de testeo), no "cualquier métrica por cualquier segmento".
- **Tool-use core** lo puse último **a propósito, no lo descarté**: que del chat salgan acciones ("pausá los ads que queman") es lo más potente y lo más peligroso; recién tiene sentido cuando las fases previas ya normalizaron el patrón acción-con-confirmación (el `mako_confirmaciones` que ya existe).

## El único cambio que le haría a mi plan

Meter **El Estratega como columna de la Fase 2**, no como un detector más. Los 6 detectores que pediste son los *sensores*; el Estratega es el *que decide qué hacer con esa señal y la plata*. Sin él, los detectores son otra vez análisis que termina en un link. Con él, la cadena se cierra: *detecto que quemás plata en un no-ganador → te digo cuánto reasignar → te doy el botón de pausar y el de lanzar el testeo nuevo.*

Actualizo la memoria con el pilar del Estratega. ¿Querés que arranque la Fase 0 (los enchufes rápidos) o preferís que primero te diseñe en detalle El Estratega — el modelo de datos, la regla de split, y cómo se ve la pantalla — antes de tocar nada?

