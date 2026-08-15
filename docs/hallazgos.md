# Hallazgos — índice

Lo que aprendimos trabajando en cada área y **no se puede deducir leyendo el código**:
el síntoma que se vio, la causa real, dónde vive y la regla que queda. Sobre todo, los
casos en que el diagnóstico obvio era el equivocado — eso es lo que ahorra días.

No son changelogs. Lo que se hizo ya está en el commit y en el código; acá va lo que
hay que saber **antes** de tocar algo.

La regla que los produce está en [AGENTS.md](../AGENTS.md) → "La cosecha": toda
corrida con subagentes termina escribiendo en el documento de su área. El área es
**dónde vive el código**, no de qué hablaba la tarea.

| Área | Documento | Qué cubre |
|---|---|---|
| CRM | [hallazgos-crm.md](hallazgos-crm.md) | Leads, funnel, etapas y requisitos, worklist de datos sin marcar, agenda y horarios, historial |
| Infraestructura | [hallazgos-infra.md](hallazgos-infra.md) | Supabase (paginado, upserts, settings), aislamiento multi-inquilino, credenciales/BYOK, webhooks, crons, topes de Next, migraciones, build y deploy, zonas horarias, storage, editar archivos grandes (CRLF y nombres colisionados), tests y sesiones paralelas, quién contesta un 401 (el middleware o la ruta), y las dos trampas de verificar en local: el error de sintaxis fantasma que sobrevive al reinicio y el panel que no hidrata |
| UI compartida | [hallazgos-ui.md](hallazgos-ui.md) | `app/_ui` y `app/_components`: el ancho y el scroll de las barras de navegación, `WizardShell`, la pila de modales y los z-index, dónde vive de verdad la marca (el manual entero está en [branding-mako.md](branding-mako.md)) y **el inventario de las 148 superficies donde MaKo se anuncia**: por qué el dorado dejó de significar MaKo, los 21 hexes dorados y los 6 glifos de estrella vivos, el único call-site de producción de `<Mako>` y los cinco pop-ups en cuatro esquinas. Y el texto de la UI: cómo se escribe una guarda que prohíbe una palabra en pantalla sin enganchar identificadores ni perderse los strings que viven en los datos, por qué la conclusión de arriba copia la de abajo si nadie lo impide, y el matcher de números que se come la puntuación |
| MaKo (IA) | [hallazgos-ia.md](hallazgos-ia.md) | Modelos y ruteo, la cascada barata y sus **dos** ejes de rotación (proveedor y cuenta), prompts y overrides, topes de salida, gasto y saldo, el doer, cómo pregunta y responde MaKo |
| Comunicación | [hallazgos-comunicacion.md](hallazgos-comunicacion.md) | Espejo de WhatsApp (Evolution), onboarding del Chat Agent, desenlace de nutriciones, y por qué el Chatbot le pone a todo cliente el funnel del dueño. Y **todo lo de Instagram antes de abrir el canal**: el webhook que no miraba de qué canal viene el mensaje (y el `Channel::FacebookPage` con el que llega medio Instagram), los TRES trámites de Meta (no dos), por qué la política de bots choca con «un canal PROPONE», y los cinco detalles que muerden al publicar contenido. Y la autopsia del bug que **no existía**: cómo la búsqueda del agente devuelve `\` donde el archivo dice `/`, y por qué «lo verifiqué ejecutándolo» no verificó nada |
| Ads | [hallazgos-ads.md](hallazgos-ads.md) | `ads-analyst` y las lecturas de `marketing_metrics_daily` |
| Landing / VSL | [hallazgos-landing.md](hallazgos-landing.md) | `landing-analyst`, `landing_visits` y `vsl_events` |
| Plan | [hallazgos-plan.md](hallazgos-plan.md) | El board, el Perro Guardián, el contrato de sus preguntas (tipo ↔ campo), el pipeline reunión → tareas y el reparto por proyecto |
| Customer Success | [hallazgos-customer-success.md](hallazgos-customer-success.md) | El bucle de entrega: por qué la tarea del cliente no puede vivir en Whop, los tres detalles de Standard Webhooks que fallan siempre, por qué el identificador de ruteo se deriva en vez de preguntarse, y el cron que tiraba las juntas de entrega con dos explicaciones falsas |
| Onboarding | [hallazgos-onboarding.md](hallazgos-onboarding.md) | El wizard del cliente nuevo: el estado y sus cuatro listas paralelas, dónde se cae la gente de verdad, la cáscara y el panel, y qué NO existe todavía (paso opcional, plan gratuito) |
| Agente del cliente | [hallazgos-agente.md](hallazgos-agente.md) | La skill y el hook que el cliente instala en SU Claude Code: por qué la telemetría no puede vivir en un prompt, cómo la redacción se genera en vez de copiarse, y las dos reglas que se pisaban entre sí |
| Conocimiento | [hallazgos-conocimiento.md](hallazgos-conocimiento.md) | El portal de cursos y la ingesta de clases: por qué no hay un solo video en el repo, la puerta al RAG que ya existe, las cuatro trampas de bajar de Google Drive (incluida la que se diagnosticó como bloqueo de Google y era un bug del parser), por qué se perdió el pipeline de la corrida anterior, y qué NO funciona para reusar la sesión de Chrome en esta máquina |
| Second Brain | [hallazgos-second-brain.md](hallazgos-second-brain.md) | El grafo del negocio: por qué un árbol no se dibuja como una red, qué es verdad y qué es mito del force layout, el determinismo de d3, las trampas de dibujar y navegar un grafo en SVG, cómo se hizo que el grafo fuera el protagonista de la pantalla, y por qué un `<div hidden>` de React deja una verificación sin hidratar y sin error |
| Seguridad | [hallazgos-seguridad.md](hallazgos-seguridad.md) | Aislamiento, cifrado de credenciales, firma de webhooks, superficie expuesta |
| Aislamiento | [auditoria-aislamiento-workspace.md](auditoria-aislamiento-workspace.md) | Multi-inquilino: qué se scopea por workspace y qué no |

Dos documentos de esta carpeta **no son hallazgos** sino contexto de arranque, y se leen
antes que todo lo demás:

| Documento | Para qué |
|---|---|
| [mapa-del-proyecto.md](mapa-del-proyecto.md) | Qué es MaKo, cómo está armado y en qué estado está cada pieza. Lo que una sesión nueva necesita saber y no está en el código |
| [dos-cuentas.md](dos-cuentas.md) | El protocolo de las dos cuentas de Claude sobre este clon: qué comparten, los dos modos de trabajo y el traspaso |
| [conectores.md](conectores.md) | Qué conectores tiene la cuenta de Claude, cuáles se usan de verdad y en qué orden conectarlos al cambiar de cuenta |
| [chats.md](chats.md) | Las 48 sesiones de trabajo: qué se hizo en cada una, qué quedó pendiente y dónde hubo fricción |
| [corridas-multiagente.md](corridas-multiagente.md) | El registro de las 260 corridas de workflow: qué se fue a buscar en cada una y si dejó algo escrito |
| [embudo-y-high-ticket.md](embudo-y-high-ticket.md) | El embudo real: los 5 canales TOFU convergen en uno, y el SaaS es el CALIFICADOR de un high ticket de US$4.000, no el negocio. Por qué el ascenso NO justifica canales de volumen y por qué la llamada regalada RESTA US$6,57 por comprador, el CAC económico de los 5 canales (solo referidos entra en el techo del Pro), la proyección a 24 meses × 4 escenarios, y por qué lo único que cambia el signo es vender el ANUAL y no el mensual (62× de caja). Con las 14 fallas que el panel adversarial encontró en el propio modelo |
| [productos-y-funnels-plan.md](productos-y-funnels-plan.md) | El **orden de trabajo** de múltiples productos con múltiples funnels (#374): las 6 fases en orden de dependencia con los archivos de cada una, los 12 lugares que empiezan a mentir si no se tocan, y las 3 preguntas del dueño ya contestadas (con las dos donde mi recomendación estaba al revés). F0 hecha |
| [modelo-oferta-producto-funnel.md](modelo-oferta-producto-funnel.md) | El **modelo de datos** de lo anterior, y el que manda: por qué son cuatro entidades (producto = una factura, oferta = un anuncio, funnel = un recorrido, participación = un caso) y no dos, por qué producto↔funnel es N:M **derivado** y la arista va a la oferta, cómo el grupo `oferta` del brief se queda sin duplicarse (`desde_brief`), y el mecanismo del espejo que deja a un lead en dos funnels sin romper ninguno de los ~1.200 lectores de hoy. Con el DDL de 0125 a 0131 y el test de aceptación |
| [sprint-servicio-mauricio.md](sprint-servicio-mauricio.md) | El encargo de **Customer Success** de Mauricio Bustos: qué compró de verdad (4 frentes, US$500/mes × 2, 10 jul → 10 sep) contra los 12 módulos que le presenté en `/vsl/mako-cs`, y por qué el alcance dice explícitamente «no se construye adentro de MaKo». El mapa de los 4 frentes contra el código, el reencuadre del generador de tableros (su cuello no es codear: es definir la evidencia), lo que ya existe y nadie sabe —sus 15 clientes ya son proyectos de su tablero— y las 6 decisiones abiertas. Se lee antes que cualquier `hallazgos-*.md` cuando el trabajo es de este encargo |
| [costos-ia-y-planes.md](costos-ia-y-planes.md) | Cuánto cuesta la IA de verdad, medido en producción: costo por acción, qué se dispara solo, los cuatro bloqueantes del medidor y el diseño de los MaKo Tokens. Más la mecánica del plan gratis (por qué el tope de tokens no alcanza) y el CAC real de los dos canales de venta. Se lee antes de tocar precios, cuotas o el plan Free |

Documentos que todavía no existen y hay que crear cuando aparezca el primer hallazgo:
`hallazgos-email.md`, si lo de Resend crece lo suficiente como para salir de
`hallazgos-comunicacion.md`.

Al crear uno, sumar su fila acá **en el mismo commit**: un documento que no está en el
índice es un documento que nadie va a abrir.

Cuando un hallazgo cruza áreas va **donde vive el código** y se enlaza desde la otra, sin
copiarlo. El caso vivo es el paginado: la trampa está en `hallazgos-infra.md` y la citan
CRM, Ads, Landing y Comunicación con su síntoma propio.

## Cómo está armado cada documento

Todos siguen la misma forma, para que se pueda saltar al punto exacto sin leerlos enteros:

1. **«Lo que más muerde acá»** al principio: las 3 a 6 trampas que más tiempo costaron en
   esa área, cada una con un salto a su sección. Si tenés dos minutos, leé eso.
2. **Secciones por subsistema**, no por tipo de hallazgo. La pregunta que responden es
   «voy a tocar X, ¿qué sabemos de X?».
3. Dentro de cada sección: **lo que está vivo y roto primero**, marcado con ⚠️; después las
   trampas; al final las decisiones y lo histórico.
4. Cada entrada tiene un título que **dice la lección** y un cuerpo de
   **Síntoma → Causa → Regla**, cerrado con la línea `Vive en:` con las rutas.

Esa última línea es lo que hace barato el corpus para un agente: **antes de tocar un
archivo, se grepea su ruta acá** en vez de abrir el documento entero. La regla está en
[AGENTS.md](../AGENTS.md) → «Y para leerlos». Con los ojos, lo mismo se lee en `/admin/docs`.

## De dónde salió este material

Tres fuentes, y conviene saber cuál es cuál porque no valen lo mismo:

| Origen | Qué aporta | Confianza |
|---|---|---|
| Trabajo de sesión | El hallazgo se escribió al resolverlo, con el código delante | Alta |
| **Los journals de 261 corridas multi-agente** (jun–ago 2026, 3.340 subagentes) | 337 hallazgos que estaban perdidos: **134 de 260 corridas nunca habían escrito nada en el repo** | **De segunda mano** — es lo que devolvió un agente en su momento, no una relectura del código de hoy. Verificá antes de actuar |
| Los 1.038 mensajes del dueño en 48 sesiones | Las reglas que pidió, las decisiones con su porqué y lo que quedó sin hacer | Alta: son sus palabras, citadas |

El registro de qué se corrió y cuándo está en
[corridas-multiagente.md](corridas-multiagente.md). Y el número de arriba es la mejor
evidencia de por qué existe la regla de la cosecha: sin una fase final que escriba en el
repo, más de la mitad del trabajo de los agentes se evapora.
