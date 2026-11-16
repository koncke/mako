# Los 12 entregables del Accelerator, hechos con MaKo (16/11/2026)

Leído en `C:/dev/wt-push-q`, rama `punta/portada-brain-login` (commit `354b78401`). Sólo lectura: no se tocó el repo.
Cada «Hoy» cita la pantalla y el archivo; cada «Falta» apunta a un ítem de la lista para implementar (I-1 … I-12).

**Los textos nuevos ya pasan las guardas de `tests/acelerador-landing.test.ts`** (medidos uno por uno): de 80 a 150 caracteres;
nada de «1:1», «garantía», «mi equipo» / «nuestro equipo», «sin tope», «recurrentes» ni voseo; el #7 dice «setter con IA», el #10
«tablero de resultados», el #11 «análisis de llamadas», y los cuatro dicen «MaKo». **Una excepción:** el #7 nuevo necesita cambiar la
guarda (ver I-6).

## De un vistazo

| # | Entregable | Lo que ya lo hace en MaKo | Lo que falta |
|---|---|---|---|
| 1 | Blueprint | El plan de arranque que MaKo escribe y apruebas, el diagnóstico de fase y el Plan | Una hoja de ruta de 90 días con los 12 entregables → **I-1** |
| 2 | Foundations Method | Offer (20 piezas, 9 notas, PDF), el Funnel Coach, avatares y razones en el Second Brain | Nada |
| 3 | Market Domination | Competitor Spy: la oferta de cada competidor con las mismas 9 notas y lo que ataca que tú no dices | Ver tu oferta contra todos y guardar tu lugar → **I-2** |
| 4 | Communication Angles | Marketing CoPilot › Oferta y comunicación › Ángulos y Tu voz | Ángulos de la competencia, qué trajo cada venta, revisión semanal → **I-3** |
| 5 | Marketing Ecosystem | Funnel Coach + «Esta semana» del CoPilot + Calendar que publica | Que la semana quede armada en el calendario → **I-4** |
| 6 | Lead Generation | Web Generator, CoPilot de anuncios, palabra clave → DM, tracking del CRM | El generador de lead magnets (archivado) → **I-5** |
| 7 | Appointment Setting | Setter con IA, agenda conectada, confirmación y no-show | Que el setter reserve la llamada → **I-6** |
| 8 | Closing Method | Análisis de llamadas (SPIN + objeciones), Grabar, seguimiento post-llamada | Guion de cierre → **I-7**; traducir la transcripción → **I-8** |
| 9 | Delivery System | Classroom: curso, comunidad y el tablero de la entrega de cada cliente | Que MaKo arme las etapas desde tu oferta → **I-9** |
| 10 | Operations & Metrics | Dashboard, Focus, KPIs, reporte de los lunes | Un tablero que se llame «Tablero de resultados» → **I-10** |
| 11 | Hiring Process | Roles, setter con IA, ranking de closers | Todo lo de contratar → **I-11** |
| 12 | Delegation Framework | Roles y permisos, Plan con el Perro, hoja Productividad | Asignar una tarea a una persona → **I-12** |

---

## 01 · Fundamentos y oferta

### 1. Blueprint
- **Hoy:** al terminar el onboarding MaKo escribe un borrador de tareas para ESE negocio (fase, cuello de botella, oferta, avatares, funnel) y se aprueba en `/plan/revisar/<id>` (`lib/todo-seed-ia.ts`, `lib/plan-propuesta.ts`). El diagnóstico de fase (1 a 5 y su cuello) es el Norte (`lib/fase-diagnostico.ts`, Ops Center › Second Brain › Diagnóstico). El Plan (`/plan`) con el Perro Guardián pone puntaje, fecha y razón a cada tarea. Si la sesión 1 a 1 se graba, MaKo saca los compromisos como borrador de tareas (`lib/plan-fathom.ts`).
- **Falta:** es una lista de tareas sembrada UNA vez por negocio (`REF_PLAN_ARRANQUE`): sin fases, sin los 12 entregables, sin fecha de entrega aprobada ni avance por entregable → I-1.
- **Texto (139):** «MaKo arma tu hoja de ruta de 90 días, en nuestra primera sesión 1 a 1 la ajustamos y la apruebas: cada entregable con su fecha y su avance.»

### 2. Foundations Method
- **Hoy:** Offer pregunta las 20 piezas (cliente, problema, resultado, método, entregables, precio, cobro…), las califica en 9 dimensiones (cliente ideal, promesa, diferenciación, certeza, esfuerzo, entrega sostenible, precio y cobro, razón para decidir, foco) y escribe la oferta nueva en PDF (`/offer`, `lib/offer-marco.ts`). La trabaja el Funnel Coach del Ops Center, con Hormozi u otro referente al frente (`app/second-brain/ChatDelCoach.tsx`, `lib/asesores/contexto.ts`). Avatares, Razones, Matriz, Persona y Personalidad viven en el Second Brain (`lib/secciones-negocio.ts`), y Copywriting, Web Generator y el CoPilot los leen.
- **Falta:** nada para que el texto sea verdad. Ojo: Offer no está en la barra desde el 2/11; se entra por el Funnel Coach.
- **Texto (141):** «Dejamos firmes tu nicho, tu avatar, tu oferta y tu precio: MaKo los revisa con IA punto por punto y los usa en cada guion, anuncio y landing.»

### 3. Market Domination
- **Hoy:** Competitor Spy (`/competitor-spy`) lee la web, el Instagram y el YouTube de cada competidor, sus mejores piezas por vistas y su funnel (píxeles, checkout, VSL). Califica SU oferta con las mismas 9 notas que la tuya (`lib/spy-oferta.ts`, `app/competitor-spy/SuOferta.tsx`) y dice qué ataca que tu negocio no menciona (`huecos`, `lib/spy.ts`). Tu forma de ser: el quiz de Personalidad (`lib/personalidad.ts`) y, en el CoPilot › Tu voz, «Lo que defiendes»: contra qué estás, quién no eres, lo que quieres que crean (`lib/copiloto/comunicacion.ts`).
- **Falta:** todo se mira de a un competidor. No hay una tabla de tu oferta contra todos, ni «el hueco que nadie ocupa», ni un posicionamiento guardado que lean los chats → I-2.
- **Texto (148):** «MaKo pone tu oferta al lado de la de tu competencia y te muestra el hueco libre: ahí definimos dónde compites, fiel a tu forma de ser y tus valores.»

### 4. Communication Angles
- **Hoy:** Marketing CoPilot › Oferta y comunicación › **Ángulos** (`/ads-manager/copiloto?tarjeta=oferta`): el dolor que más vende y sus palabras, el ángulo ganador, los que hay que probar y el quemado, lo que te piden y el momento, con nota criterio por criterio. MaKo lo lee de tu oferta, tus anuncios de 60 días (agendas, ventas, frecuencia), las objeciones de tus llamadas analizadas y tu voz en los chats (`lib/copiloto/comunicacion-ia.ts`). Al lado, **Tu voz** (tono, historia, lo que defiendes). Copywriting escribe por ángulo: «Copy de anuncio: 3 ángulos», «10 ganchos» y la biblioteca de ángulos de guion (`lib/guion-angulos.ts`).
- **Falta:** tres casilleros de Ángulos se llenan a mano: «Tu competencia» (Spy todavía no analiza sus ángulos y ganchos: `lib/funciones-mako.ts`, «Todavía no»), «Qué trajo cada venta» y «Revisión semanal» → I-3.
- **Texto (147):** «El Marketing CoPilot saca tus ángulos de tus llamadas, tus chats y tus anuncios, los cruza con tu competencia y te dice cuál vende y cuál se quemó.»

## 02 · Sistema de adquisición de clientes predecible

### 5. Marketing Ecosystem
- **Hoy:** el Funnel Coach elige uno de los 7 funnels (Instagram, YouTube, anuncios a VSL, a mensajes, a formulario, a compra directa, newsletter), calcula el presupuesto y guarda el plan con creativos, ángulos, landings y pasos (`lib/funnel-plan.ts`, `docs/marketing-copilot/funnels-simples.md`). El CoPilot trae «Esta semana» según el funnel (p. ej. tantos reels, tantos carruseles, stories y «Programar la semana») y manda las tareas al Plan (`tareasDeLaSemana` en `lib/media-buyer/copiloto.ts`, `lib/copiloto/tareas.ts`). Calendar programa reels, historias y posts en tus redes (Zernio: `app/calendario/PublicarEnRed.tsx`) y recibe «Publicar» de Video, Image y Copywriting (`app/calendario/publicar-desde-crear.ts`). Piloto automático de Instagram y YouTube (Pro).
- **Falta:** «Esta semana» es una lista con «Escribir los guiones» y «Abrir el Calendario»: no crea las piezas ni las pone en su día → I-4. (Varios canales a la vez, extra E-2.)
- **Texto (138):** «MaKo arma tu semana de contenido según tu funnel: qué pieza, en qué red y qué día, cada una en tu calendario lista para editar y publicar.»

### 6. Lead Generation
- **Hoy:** qué ya funcionó: el Funnel Coach recomienda con tu presupuesto y tus resultados (`lib/funnel-recomendado.ts`), Funnels dice de cada venta su anuncio, su landing y su VSL, y la hoja «Anuncio ganador» (Ads Analyst) del Dashboard. Web Generator (`/web-generator`): landings con IA o replicadas de una que vende, con bloques de agenda, VSL, pago, quiz y encuesta, conectadas al CRM. El CoPilot revisa tus anuncios cada día y aplica mejoras sin pasarse del presupuesto (Pro). Automations: DM a quien comenta la palabra clave; scrapear contactos de tus grupos de WhatsApp (Pro). CRM: el origen de cada lead (anuncio, % del VSL, mapa de calor, grabación de la visita).
- **Falta:** el generador de lead magnets está archivado desde el 11/11 (`LEAD_MAGNET_EN_PRODUCCION = false`, `lib/lead-magnets/archivado.ts`): hoy el regalo se arma a mano en Copywriting y Web Generator → I-5.
- **Texto (145):** «Elegimos tu funnel con lo que ya te funcionó y lo montamos en MaKo: tu landing, tus anuncios, tu lead magnet y cada lead en tu CRM con su origen.»

### 7. Appointment Setting
- **Hoy:** el setter con IA (Automations, Pro) contesta solo por WhatsApp, Instagram, Messenger y email, califica con tus criterios y manda el link de tu agenda (`lib/setter-ia-reglas.ts`, `lib/nutricion.ts`; regla 4 de `lib/flujo-ia.ts`: «MaKo no ve la agenda»). Calendly, Cal.com y Google: la reserva cae en su etapa del CRM, con confirmación y recordatorio por WhatsApp y secuencias para quien no agenda o no se presenta. Chat Analyst mide el tiempo de respuesta por setter.
- **Falta:** que el setter reserve él la llamada → I-6.
- **Texto (139), cuando esté I-6:** «El setter con IA de MaKo contesta a cada lead por WhatsApp en segundos, lo califica, le ofrece tus horarios libres y le reserva la llamada.»
- ⚠️ Hasta entonces queda el de hoy, que es verdad (y la guarda lo exige): «…lo califica y le manda tu agenda para que elija el horario.»

### 8. Closing Method
- **Hoy (análisis de llamadas, Pro):** lee las llamadas de Fathom, tl;dv, Fireflies, Zoom u Otter, o las que grabas con «Grabar» en la ficha del lead o en Cold Calling, que MaKo transcribe con tu IA (`lib/grabadores/catalogo.ts`, `lib/grabar-llamada.ts`, `app/_components/grabar/`). Separa venta de entrega y puntúa cada venta en 7 dimensiones: Situación, Problema, Implicación, Necesidad (SPIN), Propuesta, Objeciones y CTA, cada nota con su cita y su minuto; objeciones respondidas o no, momentos clave y coaching. El análisis sale en español aunque la llamada no lo sea (`lib/closing.ts`). La hoja «Closing» del Dashboard trae la tasa de cierre, qué dimensión decide tus cierres y el ranking de closers; la ficha de cada llamada, la grabación y el transcript (`app/dashboard/entidades/FichaLlamada.tsx`; `/closing` redirige ahí). Después de la llamada MaKo escribe el seguimiento en tu voz y lo deja de borrador en Chats (`lib/post-llamada.ts`).
- **Falta:** el guion de cierre (Closing Script es una pantalla «pronto» sin backend: `app/closing-script/page.tsx`) → I-7; traducir la transcripción (hoy sólo el análisis sale en español) → I-8. Sales Roleplay, también «pronto», va de extra (E-1).
- **Texto (145):** «Cierras sin presión falsa: MaKo arma tu guion con tus objeciones reales y el análisis de llamadas transcribe, traduce y puntúa cada una con SPIN.»

## 03 · Sistematización y escala

### 9. Delivery System
- **Hoy:** Classroom (`/classroom`): curso por módulos con candados y tareas que se revisan; comunidad con publicaciones, eventos y ranking; el cliente ganado en el CRM entra al curso (`lib/crm-curso-al-ganar.ts`, `app/_comunidad/`). Classroom › Clients: el tablero de la entrega por servicio, cada cliente en su etapa y con fases, mensajes por etapa y «quién necesita atención hoy y por qué» (`app/customer-success/KanbanEntrega.tsx`, `lib/servicio-etapas.ts`, `lib/cs-senal.ts`). Las sesiones de entrega grabadas se analizan: resumen, riesgos con su cita y próximos pasos (`lib/closing-entrega.ts`). Hojas CS Analyst y «Agencia o servicio» («¿cada cliente va en fecha?»).
- **Falta:** las etapas de la entrega se escriben a mano (o quedan las de fábrica); nada las saca de la oferta → I-9.
- **Texto (143):** «MaKo arma las etapas de tu entrega desde tu oferta: cada cliente en su etapa, tu curso y tu comunidad en la app, y quién necesita atención hoy.»

### 10. Operations & Metrics
- **Hoy:** Dashboard (`/dashboard`) con tableros listos (Comercial, Marketing, Closing, Cobranza, Chat Analyst, Automatizaciones, CS Analyst, Productividad…) y «Editar con MaKo»; Focus con el objetivo y la acción del día, los KPIs y el semáforo; objetivos y KPIs (`lib/objectives.ts`). El reporte semanal de los lunes por email (`reporte-semanal`, `lib/avisos-catalogo.ts`; `buildReporteSemanal`, `lib/reportes.ts`).
- **Falta:** ningún tablero se llama «Tablero de resultados», que es lo que el programa promete (`LISTA_DEL_ACELERADOR`, `lib/planes-mako.ts`); hoy se arma con Comercial y General → I-10.
- **Texto (145):** «Afinamos en MaKo tus automatizaciones y tu CRM, y cada lunes lees tus leads, reuniones y ventas en tu tablero de resultados: decides con números.»

### 11. Hiring Process
- **Hoy:** lo que MaKo cubre sin contratar: el setter con IA, la IA que escribe y edita, el CoPilot que pauta. Equipo (Settings › Equipo): setter, closer o admin, hasta 5 personas en Pro (`app/equipo/EquipoView.tsx`, `lib/topes-plan.ts`). Cómo rinde cada uno: el ranking de closers del análisis de llamadas y el tiempo de respuesta por setter.
- **Falta:** contratar no existe en el código: ni vacante, ni candidatos, ni filtro → I-11.
- **Texto (142):** «Definimos qué puestos ya cubre MaKo y a quién sumar: MaKo filtra a tus candidatos y el análisis de llamadas te muestra cómo vende quien entra.»

### 12. Delegation Framework
- **Hoy:** cada rol ve lo suyo: el setter, CRM, WhatsApp y Email; el closer, CRM, WhatsApp y Closing; y cada uno su hoja del Dashboard (`HOJA_DE_ROL`, `lib/graficos-plantillas.ts`). El Plan con el Perro, las tareas que salen de cada reunión grabada y la hoja Productividad (avance, estancadas, a tiempo). Grupos de la app para hablar con tu equipo dentro del Ops Center.
- **Falta:** no se le asigna una tarea a una persona. El Plan sólo sabe «Míos / De clientes / De terceros / Sin asignar» (`app/plan/board/kanban.ts:151`); el nombre del responsable sólo lo escribe la extracción de reuniones, y no hay «Mis tareas» ni cumplimiento por persona → I-12.
- **Texto (133):** «Definimos qué delegar y a quién: cada persona entra a MaKo con su rol, recibe sus tareas en tu plan y ahí ves si las cumple a tiempo.»

---

## Lo que hay que implementar para que los textos sean verdad

Cada ítem se entiende solo. Tamaño: **chico** (un día), **mediano** (unos días), **grande** (una semana o más).

**I-1 · Blueprint de 90 días** — para Blueprint · **mediano**
Al entrar un cliente del Accelerator, MaKo arma su hoja de ruta con las 3 fases y los 12 entregables del programa (los de
`app/accelerator/contenido.ts`) como proyectos del Plan, cada uno con su hito, su fecha y sus primeras tareas, leyendo el onboarding,
el diagnóstico de fase, la oferta y el plan del Funnel Coach. Se revisa y se aprueba con la fecha de entrega, como el borrador de hoy.
Después cada entregable muestra su avance (tareas hechas) y si va en fecha.
Dónde: `lib/todo-seed-ia.ts` (hoy siembra un solo plan por negocio: `REF_PLAN_ARRANQUE`), `lib/plan-propuesta.ts`,
`app/plan/revisar/[id]/`, `lib/todo-proyectos-catalogo.ts`, `app/plan/TodoBoard.tsx`. Hay que poder marcar al negocio como del
Accelerator: el programa no es un plan de la app (se vende por llamada, `PROGRAMA_ACELERADOR` en `lib/planes-mako.ts`).

**I-2 · Mapa del mercado y tu posicionamiento** — para Market Domination · **mediano**
Una vista nueva en Competitor Spy: tu oferta y la de cada competidor en columnas, nota por nota en las 9 dimensiones de Offer (Spy ya
califica a cada uno con el mismo analista), con su precio y su promesa. Debajo, el hueco: lo que ninguno promete, juntando los
`huecos` de cada uno. MaKo propone tu lugar (a quién le hablas, contra quién compites y la frase que te separa), cruzado con «Lo que
defiendes» de Tu voz. Lo que apruebas queda como «Tu posicionamiento» en el Second Brain y lo leen Copywriting, Web Generator y el CoPilot.
Dónde: `app/competitor-spy/` (pestaña nueva), `lib/spy-oferta.ts`, `lib/spy.ts`, `lib/offer-marco.ts`, `lib/secciones-negocio.ts`
(sección nueva), `lib/copiloto/comunicacion.ts`.

**I-3 · Ángulos completos** — para Communication Angles · **mediano**
Llena solos los tres casilleros de Ángulos que hoy son a mano. «Tu competencia»: Spy lee los ganchos y ángulos de las piezas que más
rinden de cada competidor (ya transcribe sus reels) y MaKo los compara con los tuyos. «Qué trajo cada venta»: cada pieza (guion de
Copywriting, anuncio, reel, carrusel) lleva su ángulo y, con el tracking del CRM, MaKo cuenta agendas y ventas por ángulo.
«Revisión semanal»: cada lunes, qué ángulo trajo más agendas y cuál se quemó (frecuencia mayor a 3 y costo en subida, la regla que ya usa).
Dónde: `lib/copiloto/comunicacion.ts` (ítems `competencia`, `venta`, `semana`), `lib/copiloto/comunicacion-ia.ts`, `lib/spy.ts`,
`lib/copywriter/`, `lib/media-buyer/senales.ts`, `lib/avisos-catalogo.ts`.

**I-4 · La semana armada en el Calendario** — para Marketing Ecosystem · **mediano**
Con el funnel elegido, «Esta semana» deja de ser una lista: MaKo crea cada pieza en borrador (el guion del reel en Copywriting, el
carrusel en Image, con el ángulo de la semana) y la pone en su día y su hora del Calendar como Publicación, lista para editar y
programar en la red. Si la persona la mueve de día, se mueve en el calendario; lo que no se hizo, lo avisa.
Dónde: `lib/media-buyer/copiloto.ts` (`tareasDeLaSemana`), `app/ads-manager/copiloto/cargar.ts`, `app/calendario/actions.ts` y
`PublicarEnRed.tsx`, `lib/calendario-desde-crear.ts`, `lib/copywriter/operaciones.ts`.

**I-5 · Lead Magnet, rehecho** — para Lead Generation · **mediano**
Volver a abrir el generador que Martín archivó el 11/11 («no está bien construido… luego lo haremos bien»): MaKo propone el regalo
desde tu oferta y tu competencia, arma la pieza (guía, checklist, plantilla, clase o quiz), su página con formulario que entra al
CRM, y la automatización que lo manda por DM a quien comenta la palabra clave. El código está entero: no alcanza con prender el
interruptor, hay que rehacer lo que no le gustó.
Dónde: `lib/lead-magnets/archivado.ts` (`LEAD_MAGNET_EN_PRODUCCION`), `app/lead-magnet-generator/`, `lib/lead-magnets/`,
`docs/hallazgos-lead-magnets.md`, `tests/lead-magnet-archivado.test.ts`.

**I-6 · El setter reserva la llamada** — para Appointment Setting · **mediano**
En la charla, el setter con IA mira tus horarios libres, le ofrece dos o tres al lead, reserva el que elige, se lo confirma por
WhatsApp y lo mueve a su etapa del CRM. Hoy manda el link porque la regla 4 del motor dice «MaKo no ve la agenda». Google Calendar
ya se lee y se escribe desde MaKo (`horariosLibresDeGoogle` y `crearEventoDeReunion`, `lib/google-calendar.ts`); Cal.com reserva por
API; con Calendly, medir antes si su API deja reservar o seguir con el link.
Dónde: `lib/flujo-ia.ts`, `lib/nutricion.ts` (`redactarRespuesta`), `lib/google-calendar.ts`, `lib/calcom.ts`, `lib/setter-ia-reglas.ts`.
⚠️ En el mismo commit: el texto del #7 (`app/accelerator/contenido.ts`) y su guarda (`tests/acelerador-landing.test.ts`, líneas
366-369, exige «le manda tu agenda para que elija el horario»).

**I-7 · Guion de cierre** — para Closing Method · **mediano**
MaKo escribe el guion de tu llamada de venta con tu oferta (las piezas de Offer) y las objeciones que de verdad aparecen en tus
llamadas analizadas: la apertura, las preguntas SPIN, cómo presentar, la respuesta a cada objeción (la que mejor funcionó en las
ganadas) y el cierre con el cobro. Se actualiza cuando entran llamadas nuevas, y el análisis puede marcar en qué parte del guion se
salió el closer.
Dónde: hoy «Closing Script» es una pantalla «pronto» (`app/closing-script/page.tsx`; key `closing-script` en `PRONTO`,
`app/_components/nav.ts`). Por la regla de Create («no quiero otras tabs»), mejor como plantilla de Copywriting («Guion de cierre»,
`lib/copywriter/plantillas.ts`) que llena MaKo con `lib/closing.ts` (objeciones de `closing_analyses`) y `lib/offer-marco.ts`.

**I-8 · Traducir la llamada** — para Closing Method · **chico**
Un botón en la ficha de la llamada que traduce la transcripción al español (o al idioma del negocio), con sus minutos, para leer una
llamada en inglés o en portugués. El análisis ya sale en español (`lib/closing.ts`: «Todo en español neutro»); la transcripción no.
Dónde: `app/dashboard/entidades/llamada.tsx` (la pieza «transcript»), `app/api/closing/transcript/`.

**I-9 · La entrega, armada desde tu oferta** — para Delivery System · **mediano**
MaKo lee las piezas de la oferta que hablan de la entrega (los entregables con sus fases e hitos, la primera semana, el formato y lo
que cuesta atender a un cliente) y propone las etapas del servicio con sus fases, un checklist por etapa y el mensaje que sale al
llegar a cada una. Al aprobarlo se arma el tablero de Clients de ese servicio. Y avisa si la nota «Entrega sostenible» de Offer es baja.
Dónde: `lib/servicio-etapas.ts`, `lib/entrega-servicio.ts`, `app/customer-success/EtapasEntregaModal.tsx`, `lib/offer-marco.ts`
(piezas `entregables`, `semana`, `formato`, `costo`), `lib/nutricion.ts` (`secuenciasPorEtapaDeEntrega`).

**I-10 · Tablero de resultados** — para Operations & Metrics · **chico**
Una plantilla del Dashboard con ese nombre, la que promete el programa («Tus leads, tus reuniones y tus ventas, desde la primera
semana»): leads, reuniones agendadas y asistidas, ventas y cobrado, semana a semana desde el día uno y contra la meta. El reporte de
los lunes lleva a ella.
Dónde: `lib/graficos-plantillas.ts` (junto a Comercial y Marketing), `lib/reportes.ts` (`buildReporteSemanal`).

**I-11 · Contratación** — para Hiring Process · **mediano**
Un tipo de CRM «Contratación» con sus etapas (aplicó, entrevista, prueba, contratado o descartado); una plantilla de Web Generator
para la página de la vacante, con un formulario por pasos que califica con tus criterios (el molde es `/accelerator/aplicar`). La
entrevista se agenda en Calendar, se graba y MaKo la analiza con la rúbrica del puesto, como ya hace con las sesiones de entrega.
Al contratar, la persona pasa a Equipo con su rol.
Dónde: `lib/pipeline.ts` (`TIPOS_CRM`), `lib/editor-landing/plantillas.ts` y `catalogo-bloques.ts` (quiz y encuesta ya existen),
`lib/aplicacion-accelerator.ts` (molde del formulario), `lib/closing-entrega.ts` (molde de un análisis con su propio contrato),
`app/equipo/EquipoView.tsx`.

**I-12 · Tareas por persona** — para Delegation Framework · **mediano**
En el Plan, cada tarea se asigna a una persona de Equipo; cada setter o closer ve «Mis tareas» con sus fechas, MaKo le avisa cuando
una vence, y el dueño ve en la hoja Productividad cuántas cumple a tiempo cada uno. Hoy el Plan sólo distingue «Míos / De clientes /
De terceros / Sin asignar», y el responsable lo escribe sólo la extracción de reuniones (sin control en pantalla).
Dónde: `lib/todo.ts` (`responsable`, `responsable_email`), `app/plan/board/kanban.ts` (`RESPONSABLES_FILTRO`),
`app/plan/board/types.ts`, `app/plan/TodoBoard.tsx`, `lib/graficos-plantillas-analysts.ts` (`PRODUCTIVIDAD`), `lib/avisos-catalogo.ts`.

**Extras: suman, pero ningún texto los necesita**
- **E-1 · Sales Roleplay** (grande): practicar una llamada con una IA que hace de tu lead, con tus avatares y tus objeciones reales, y salir con la nota de las 7 dimensiones; sirve para entrenar closers y probar candidatos. Hoy «pronto»: `app/sales-roleplay/page.tsx`.
- **E-2 · Varios canales en orden** (mediano): el plan guarda un solo funnel (`lib/funnel-plan.ts`) y el CoPilot lee uno (`funnelElegido`); sumar canales con su mes y reusar un video largo en reels, carrusel y newsletter.
- **E-3 · Alerta de baja** (mediano): juntar los riesgos de las sesiones de entrega (`lib/closing-entrega.ts`), las cuotas vencidas y el silencio (`lib/cs-senal.ts`) en un aviso de «este cliente se puede ir». Hoy es un «Todavía no» de `lib/funciones-mako.ts`.
- **E-4 · Curso para tu equipo** (mediano): un curso de Classroom para la persona nueva (cómo vendes, tus guiones, tus objeciones); hoy el curso abre sólo a clientes ganados o dados a mano (`lib/curso-invitar-reglas.ts`).
- **E-5 · Roles a medida** (mediano): además de setter, closer y admin (`RolWorkspace`, `lib/auth-session.ts`), un rol «Contenido» o «Media buyer» con las pantallas que elijas.
- **E-6 · Los anuncios de la competencia, solos** (mediano): Spy guarda los anuncios que pegas; traerlos de la biblioteca de Meta es otro «Todavía no».

---

## Las landings de funciones de la portada

**Las que hay hoy.**
- **Menú «Producto»** (`app/vsl/_sitio/datos.ts`, `COLUMNAS`): las 19 del molde nuevo (`app/vsl/_competencia/registro.ts`).
  Today: Ops Center (`/vsl/mako`), Dashboard, Chats (`/vsl/whatsapp`), Plan (`/vsl/prioridades`), Email, y Second Brain sin landing
  (va a `/#brain`). Sales: CRM, Automations (`/vsl/seguimiento`), Agenda, Cobranza. Marketing: Marketing CoPilot (`/vsl/ads`), Offer,
  Competitor Spy, Ads Analyst (`/vsl/script`), Funnels. Create: Video, AI Avatar, Image, Copywriting, Web Generator.
- **Industrias:** Agencias (`/agency`, pide sesión), Coaches, Infoproductores, Inmobiliarias. **Funnels:** 4 de los 7, en
  `/vsl/funnels/<id>`: VSL con llamada, Anuncios a WhatsApp, Instagram con lead magnet, YouTube.
- **Las 14 viejas** (`FeatureDetail`, `app/vsl/_detalle/features.ts`), públicas pero fuera del menú y con recuadros en vez de la app:
  `/vsl/api`, `closing`, `conocimiento`, `contrato`, `customer`, `equipo`, `experimentos`, `fase-norte`, `integraciones`,
  `onboarding`, `perfil-reportes`, `pipeline`, `retro`, `semaforo`.
- **La portada** (`TARJETAS_PORTADA`): 14 filas que cuentan la venta de punta a punta, del Second Brain al curso. **No hay fila de la
  llamada:** entre Chats y los tableros falta Closing.

**Las que faltan, de funciones que MaKo ya tiene.**
1. **Closing** (rehacer `/vsl/closing` con el molde nuevo, sumarla a Sales y darle su fila en la portada). Hoy es la vieja: sólo
   Fathom, con R1/R2 (el CRM de dos reuniones salió el 16/11), con voseo en el titular («perdés») y recuadros; y la enlazan los funnels
   de VSL y YouTube. Contaría: cada llamada de venta grabada, transcrita y puntuada con SPIN, dónde se cae el cierre, qué objeción
   quedó sin responder, el seguimiento ya escrito y cómo cierra cada closer; con Fathom, Zoom, tl;dv, Fireflies, Otter o «Grabar».
2. **Classroom: curso y comunidad** (nueva). La fila «Curso y comunidad» de la portada va sin link. Contaría: tu curso por módulos,
   tu comunidad y la entrega de cada cliente en la misma app con la que vendes; quien compra entra solo al curso.
3. **Second Brain** (nueva). Contaría: el mapa de tu negocio que leen todos los chats de MaKo; subes tus documentos, aprende solo de
   tus chats y te lo llevas en un ZIP.
4. **Equipo** (rehacer `/vsl/equipo`). Contaría: tu setter, tu closer y tu admin, cada uno con lo suyo, su hoja, sus llamadas
   puntuadas y su tiempo de respuesta; hasta 5 personas en Pro.
5. **Calendario de contenido** (dentro de `/vsl/agenda`, que hoy habla sólo de llamadas, o propia). Contaría: programas reels,
   historias y posts y salen a la hora que eliges; lo que haces en Video, Image o Copywriting llega al calendario con un toque.
6. **API de MaKo** (pública: `/api-mako` pide sesión y la vieja `/vsl/api` habla de la API de Meta). Contaría: todo MaKo por API;
   tu Claude Code o tu integración leen tu CRM y hacen lo mismo que tú, con tokens y registro de uso.
- **Funnels que faltan** (los otros 3 de los 7 del CoPilot): Anuncio con formulario (dejan sus datos en el anuncio y tu setter los
  contacta en minutos), Venta directa (pagan en tu página y cada compra queda con su anuncio) y Newsletter (con Email; la tab
  Newsletters sigue «pronto»).

**Cómo se suma una** (`docs/relevo/nube-landings-competencia.md`): `app/vsl/_competencia/<slug>.ts` con su referencia y sus bloques,
`registro.ts`, su `page.tsx`, su slug en `COLUMNAS`; la fila de la portada en `TARJETAS_PORTADA`, con una grabación real de la app
(«nada inventado»: si no hay, el recuadro `falta`). El número «funciones en una sola app» se cuenta solo. Para Closing la
investigación del 11/11 no encontró referencia en español: quedan Fathom, Gong o Hyperbound para mirar desde el Chrome de Martín.
