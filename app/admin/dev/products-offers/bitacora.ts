// =============================================================================
// Products & Offers — registro de construcción
// =============================================================================
// El área cubre TRES cosas que se construyen juntas y que antes se pensaban como
// una sola: el catálogo de productos, la entidad OFERTA (que no es lo mismo) y la
// relación N:M con los funnels. Por eso el registro vive acá y no en Onboarding,
// aunque hoy la única pantalla sea un paso del wizard.
//
// Qué va acá y qué no: el motivo y la trampa, no el changelog. Los tipos y la
// forma de una entrada están en ../_registro/tipos.ts. El detalle técnico vive
// en docs/modelo-oferta-producto-funnel.md (el modelo, que manda) y
// docs/productos-y-funnels-plan.md (el orden de trabajo).

import type { Hito, Parte } from '../_registro/tipos';

const CH = 'Múltiples productos y funnels (#374)';

export const BITACORA: Hito[] = [
  {
    fecha: '10 ago', hora: '19:40', chat: CH, cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: '«Nos traba en muchos otros desarrollos»',
    pedido: 'Tenemos un gran pendiente que ya lo comenzamos a trabajar con otros chats y que también está en el plan, que es algo que nos traba en muchos otros desarrollos que tenemos por delante, que es concluir la carga de multiples profuctos/ofertas y asignarles multiples funnels a cada uno...\n\nRepercute mucho en muchas cosas...\nRevisalo y proponme un plan de acción.',
    puntos: [
      'El pedido no era construir una tabla: era destrabar. La pregunta a contestar antes de proponer nada era **qué está realmente hecho** de #374 y qué se rompe río abajo con N funnels.',
      'Se relevó con 15 subagentes en paralelo (7 lectores + 3 diseños + 3 jueces + radio de impacto).',
    ],
  },
  {
    fecha: '10 ago', hora: '20:13', chat: CH, cuenta: 'claude2', actor: 'claude', tipo: 'investigacion',
    titulo: 'El funnel es uno por CONSTRUCCIÓN, y el diagnóstico obvio era el equivocado',
    puntos: [
      '**`leads.producto_id` es una columna muerta desde la 0117.** Ninguna línea de TypeScript la lee ni la escribe: no está en el tipo `Lead`, ni en `LISTA_COLS`, ni en `COLS_FILTRO`. La mitad declarada de #374 —«el deal hereda el pricing del producto»— nunca existió.',
      '**Multi-funnel no es una columna: es cambiar la identidad de la fila.** Son CUATRO cerrojos y tres son invisibles al compilador — un índice único `funnel_config_ws_uk`, tres upserts con `onConflict:\'workspace_id\'` (`saveFunnel`, `clonarConfigDelDueno`, `datos-mau`), y un `.maybeSingle()` que con dos filas devuelve `PGRST116` y el `catch` lo convierte en `DEFAULT_PIPELINE` **sin un solo log**. Todo el CRM pasaría a pintar el pipeline genérico y nadie se enteraría.',
      '⚠️ **Y el diagnóstico obvio era el equivocado.** El instinto decía «hay que prefijar las stage keys por funnel para que dos pipelines no se pisen». Falso: `deriveStageKey` **no lee `funnel_config` en absoluto** — es un switch puro sobre `estado_lead` + fechas + asistencias, con 11 keys canónicas escritas a mano. El funnel editable define qué columnas se pintan, no dónde cae un lead. El ámbito va en una COLUMNA, nunca en el nombre de la key: prefijar invalidaría todos los `pipeline_stage` guardados, `lead_audit` y `etapa_vista`.',
      '**Lo único que se sale de la pantalla y le llega a una persona:** `leadsDeCohorte(\'etapa_actual\')` trae todos los leads abiertos del workspace y filtra en memoria por etapa, sin ámbito de funnel. Dos funnels con `noshow_r1` se cruzan WhatsApps y emails REALES, sin error y sin log.',
      'Lo que ya estaba bien y no había que tocar: el MODELO de `lib/pipeline.ts` recibe el pipeline por parámetro y no toca Supabase. Lo acoplado a «hay uno» son las funciones de acceso de `lib/leads.ts`, no el modelo.',
    ],
    commits: [{ sha: '307f422', msg: 'El funnel es uno por construcción, y el catálogo de productos no lo usa nadie', lineas: 576, archivos: 5 }],
    archivos: [
      'docs/productos-y-funnels-plan.md — el plan de acción (6 fases)',
      'docs/hallazgos-crm.md — el funnel singleton, deriveStageKey, la nutrición cruzada',
      'docs/hallazgos-onboarding.md — el paso roto y el catálogo',
    ],
  },
  {
    fecha: '10 ago', hora: '23:32', chat: CH, cuenta: 'claude2', actor: 'claude', tipo: 'implementacion',
    titulo: 'F0 — el paso de Productos por fin cierra, y /email deja de escribir para Mauricio',
    puntos: [
      '**El paso `productos` reventaba en silencio.** Estaba en `PasoOnboarding` y en el orden de la capa, la pantalla se pintaba, pero la clave **no existía** en `OnboardingState.steps` ni en el union `Body.step`: cerrarlo era `undefined.done = true` → 500. Y como el wizard no miraba `ok`, el cliente avanzaba igual y al volver aterrizaba SIEMPRE ahí.',
      'Las **cuatro listas paralelas** se colapsaron en una: `PASOS_ONBOARDING` en `lib/capas.ts` es la fuente, el tipo sale de ella con `typeof …[number]`, el esqueleto del estado se arma con `Object.fromEntries` y el endpoint valida con `esPasoOnboarding()` **en positivo**. Agregar el paso a mano en las cuatro habría arreglado éste y garantizado que el próximo naciera igual de roto.',
      'La puerta barata que nadie había visto: `getEstadoOnboarding` ya hace deep-merge del `steps` guardado sobre el esqueleto, así que **los clientes ya persistidos se arreglan solos al leerse**. No hubo que tocar `app_settings` de nadie.',
      '**La IA completaba PISANDO.** La sugerencia hacía `UPDATE` de TODAS las columnas con lo que devolvía el modelo, así que una garantía escrita a mano desaparecía al volver a pedir sugerencias — y al modelo se le pasaban solo el nombre y el precio, con lo cual no podía «completar» lo que nunca vio. Ahora recibe el producto entero y el merge es **campo a campo**: lo que ya tiene valor gana siempre. La regla vivía solo en la prosa del prompt; ésta es la capa determinista que AGENTS.md exige.',
      '**`/email` mandaba copy del negocio de OTRO cliente.** El system decía literal «escribiendo para Mauricio Bustos (Negocio que Escala™)» y ordenaba usar SU Calendly, hardcodeado para todos los workspaces. Ahora se arma con perfil + voz + funnel reales del workspace (molde de `nutricion-generator`), es editable desde /configuraciones, y sin link en el contexto escribe `[LINK DE AGENDA]` en vez de inventar uno.',
      'Verificado contra la app corriendo (ws3, base de prod): `step:\'productos\'` → 200 y persiste; paso inventado → **400** con mensaje, ya no un 500 mudo. Dos corridas reales de «sugerir»: la primera completó `monto_usd` de null a 5000 sin tocar promesa/incluye/garantía; la segunda, sobre el producto ya completo, **no cambió un solo campo ni creó duplicados**. 554/554 tests.',
    ],
    commits: [{ sha: '97f98ba', msg: 'El paso de Productos por fin cierra, y /email deja de escribir para Mauricio', lineas: 331, archivos: 13 }],
    archivos: [
      'lib/capas.ts — `PASOS_ONBOARDING` (fuente única) + `esPasoOnboarding()`',
      'lib/onboarding-state.ts — `steps` derivado del catálogo, no escrito a mano',
      'app/api/onboarding/productos/route.ts — `completar()`: el merge campo a campo, y el `norm()` del dedup sin tildes',
      'lib/productos-ia.ts — le pasa el producto ENTERO al modelo + el pin de /modelos-ia',
      'app/api/email/generar/route.ts — `EMAIL_GEN_SYSTEM_TEMPLATE` con perfil/voz/funnel del workspace',
      'lib/reset-workspace.ts · lib/clonar-config.ts · lib/datos-mau.ts — `productos` entra a los tres',
    ],
  },
  {
    fecha: '10 ago', hora: '23:40', chat: CH, cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'Las tres respuestas que dieron vuelta el modelo',
    pedido: '1. No entiendo la primera pregunta... Un producto puede tener varios funnels, y un funnel puede tener varios productos... Muchas veces los funnels son diferentes en el TOFU pero luego en el BOFU son lo mismo, terminan todos con llamada de ventas por ejemplo, y en el TOFU es organico, otro por ads, etc...\n2. Si, un lead podría aparecer en 2 funnels a la vez, ya que no terminó de cerrar en un funnel y meses después aparece en otro... Pero eso no significa duplicar al lead.\n3. No, oferta no debe desaparecer. Una oferta es mucho más que un producto... Contiene otras cosas que para un dueño de negocio es importante para poder vender.',
    puntos: [
      '**Dos de las tres recomendaciones estaban al revés**, y las dos se habían escrito con confianza. Vale dejar por qué se erró, no solo qué se corrigió.',
      '(2) «Un lead = un funnel a la vez» tenía bien el diagnóstico del costo —`leads` tiene DOS pares de columnas de reunión y `slotPorIndice` devuelve null del índice 2— y mal la conclusión: **que algo sea caro no es un argumento para que el producto no lo haga**.',
      '(3) «Deprecar el grupo `oferta`» partía de que oferta y producto eran la misma cosa a dos escalas. No lo son. Y había un dato medible que no se había medido: `perfilNegocioTexto()` alimenta **~20 features** y el catálogo `productos` **2** — `lib/mako-context.ts`, el system prompt de MaKo, no lee productos en absoluto. Apagarlo dejaba ~18 features sin promesa, precio ni garantía.',
      '(1) La pregunta estaba mal formulada («¿el canal baja al funnel?») y él lo dijo. Su respuesta la contestó igual: el funnel tiene **dos mitades**, el TOFU es lo que diferencia dos funnels y el BOFU suele ser compartido.',
    ],
  },
  {
    fecha: '10 ago', hora: '23:54', chat: CH, cuenta: 'claude2', actor: 'claude', tipo: 'investigacion',
    titulo: 'Cuatro entidades, y la oferta sube de nivel en vez de morir',
    puntos: [
      '**El criterio que separa las entidades no es su tamaño, es qué pregunta contestan.** Un cambio en el PRODUCTO cambia una factura; en la OFERTA, un anuncio; en el FUNNEL, un recorrido; en la PARTICIPACIÓN, un caso. Con ese criterio la discusión «¿son dos o cuatro?» se cierra sola.',
      '**La arista va a la OFERTA, no al producto.** «TOFU distinto, BOFU compartido» son dos funnels vendiendo lo mismo con otra promesa y otro bono: eso es otra OFERTA del mismo producto. Si el funnel colgara del producto no habría dónde guardar esa diferencia. producto↔funnel queda N:M pero **derivado** (`funnel_ofertas ⋈ oferta_productos`), nunca guardado aparte.',
      '**El grupo `oferta` del brief no se apaga NI se copia.** La fila existe en `ofertas` con los 5 campos en NULL y `desde_brief = true`; el valor sigue viviendo en el blob de `app_settings` y lo resuelve `ofertaPrincipal()`. Cero duplicación, cero backfill de datos, y una columna dice dónde vive el dato en vez de que haya dos copias divergiendo.',
      '**El lead en dos funnels sale barato por un motivo que no era obvio: la etapa NO está guardada.** `deriveStageKey` la deriva de 8 columnas del intento. Si `leads` sigue trayendo esas 8 con los valores de la participación vigente, `pipelineStageOf` sigue devolviendo lo correcto y los ~1.200 lectores de hoy no se tocan. `lead_participaciones` es la fuente de verdad y `leads` su ESPEJO, escrito por UN solo writer. **Ninguna columna se dropea nunca.**',
      '**El BOFU compartido NO es una entidad**, y esa fue la tentación más fuerte. Tres funciones razonan por el índice de la etapa dentro del pipeline completo (`generateFunnel`, `funnelReqInfo`, `salidasDeEtapa`): un tramo referenciado obliga a meter un offset en las tres. El repo ya lo resolvió sin entidad — la plantilla `presencial` comparte el cierre **reusando la clave canónica**. Lo que el dueño pide de verdad sale con `nutricion_secuencias.funnel_id` NULLABLE = «sirve a todos».',
      '⚠️ **Una trampa del propio relevamiento, que ya es regla en AGENTS.md:** los agentes leyeron el árbol DESPUÉS de F0 y reportaron que los hallazgos «arrancaban de una premisa falsa» — porque el bug se había arreglado dos horas antes. Un agente no distingue «nunca estuvo roto» de «se arregló hace una hora». Antes de declarar viejo un hallazgo, `git log` del archivo.',
    ],
    commits: [{ sha: 'd001270', msg: 'El modelo: cuatro entidades, y la oferta sube de nivel en vez de morir', lineas: 1384, archivos: 6 }],
    archivos: [
      'docs/modelo-oferta-producto-funnel.md — el modelo, con el DDL de 0125 a 0131 y el test de aceptación. **Es el que manda**',
      'docs/productos-y-funnels-plan.md — queda con el orden de trabajo y linkea',
      'AGENTS.md — la regla del hallazgo arreglado vs. el hallazgo viejo',
    ],
  },
  {
    fecha: '10 ago', hora: '23:57', chat: CH, cuenta: 'claude2', actor: 'claude', tipo: 'cosecha',
    titulo: 'Los conteos contra prod, y el bug que no tiene víctima',
    puntos: [
      '**1.000 leads** (880 ws1 + 120 ws3) → el backfill de la 0128 entra en un solo statement transaccional. **4 filas** en `funnel_config`. **2 productos en total** y CERO colisiones de nombre normalizado → el unique se aplica sin saneo previo. **0 leads** con `producto_id`: confirmado, la columna sigue muerta.',
      '⚠️ **Y una corrección al propio modelo:** la sección «un bug que está VIVO hoy» estaba sobrevendida. Cero leads perdidos/ganados con una R1 futura — el mecanismo del reagendo que pisa el historial está en el código, pero **no tiene ninguna víctima en producción**. Las 4 filas de `lead_audit` con `Fecha R1` sobrescrita tampoco lo prueban: un reagendo manual escribe lo mismo.',
      '**La lección que se guarda: un bug leído en el código no es un bug medido en la base**, y la diferencia decide si se adelanta o no una fase entera.',
    ],
    commits: [{ sha: '8a38d2c', msg: 'Los conteos contra prod, y el bug que no tiene víctima', lineas: 26, archivos: 2 }],
  },
  {
    fecha: '11 oct', hora: '07:55', chat: 'Offer: chat con IA, diagnóstico y PDF', cuenta: 'claude3', actor: 'martin', tipo: 'prompt',
    titulo: 'Offer Analyst y Offer Generator en UNA tab, con un chat de IA y un PDF',
    pedido: 'Implementa completamente la funcionalidad de "Offer Analyst" y "Offer Generator" Pero todo en una mista tab que se llame "Offer"...\nElimina la tab de "Análisis", llevala dentro de "Experiments"...\n\nY para la implementación de "Offer", revisa las transcripciones de los cursos que tenemos en CONOCIMIENTOS... Hay muchos que hablan justamente de esto, de la oferta, e incluso tienen templates sobre como crear una.\nRevisa lo de Sofia Contreras, Marcos Razzetti, Ramiro Cubria, Juan Carrizo, y todos los que hablen de oferta para basarte en esta tab...\n\nQuiero que esta tab sea muy de "IA", es decir, que en lugar de formularios larguisimos para entender lo que vende el usuario, prefiero algo simple como un chat con una IA, donde el usuario pueda escribir o mandar audio o adjuntar como en el "Archivero" como ya hacemos en muchos lugares...\n\nDiseñalo bien, revisa que sea entendible, que no tenga mucho texto la tab y que el "resultado final" sea que te de un PDF con la conclusión... Y claro que se pueda visualizar allí también la conclusión.',
    puntos: [
      'Revive la etapa P2 que se había eliminado el 03/10. Los deadlines que Martín sacó a mano del tablero NO se reponen.',
      'Confirma la decisión que ya estaba escrita el 25/09: si el Analyst terminaba siendo un chat que dice qué mejorar, se fusionaba con el Generator en una tab con dos modos.',
    ],
  },
  {
    fecha: '11 oct', hora: '13:30', chat: 'Offer: chat con IA, diagnóstico y PDF', cuenta: 'claude3', actor: 'claude', tipo: 'implementacion',
    titulo: 'La tab Offer: chat → diagnóstico de 9 dimensiones → oferta nueva → PDF; Análisis pasa a Experiments',
    puntos: [
      'El marco salió de leer los cursos: 6 investigadores (MasteryHaus, BlueHacker, Sell Your Knowledge, ATV, Hormozi/Maffia/Escala 100k y un barrido de 12 más) y una síntesis con atribución por autor en docs/offer-marco.md.',
      'Un chat donde el dueño escribe, dicta o adjunta; MaKo ya trae lo que sabe del negocio (Archivero, oferta, productos, fase) y pregunta de a una pieza. Con las 5 piezas mínimas ofrece «Armar mi oferta»: diagnóstico (lo calcula el código: puntaje, cuello, lista para vender) y la oferta nueva con «[completar]» donde falta un dato, nunca inventado.',
      'Cada cambio propuesto lleva «Probarlo», que abre el alta de experimento con la hipótesis escrita: fuera de /experimentos MaKo no declara verdades.',
      'El PDF se escribe a mano (lib/pdf-escritor.ts) para no hacer un npm install sobre un lockfile con cambios ajenos. La prueba por rotura destapó que pdf.js repara en silencio un xref corrido.',
      'Análisis es la cuarta tab de Experiments (/analisis redirige con su query) y ya no la esconde el corte de Meta.',
      'IA gratis por la cascada del cliente (gemini, groq, openrouter) con la red de plataforma; sin Claude.',
    ],
    archivos: [
      'docs/offer-marco.md — el marco de oferta destilado de los cursos',
      'docs/hallazgos-offer.md — lo que costó y lo que quedó sin hacer',
      'lib/offer-marco.ts — el contrato: piezas, rúbrica, tipos',
      'app/offer/OfferApp.tsx — la pantalla (chat, generando, conclusión)',
      'app/api/offer/route.ts — la API (turno, leer, diagnosticar, generar, guardar)',
    ],
  },
  {
    fecha: '11 oct', hora: '18:04', chat: 'Offer: chat con IA, diagnóstico y PDF', cuenta: 'claude3', actor: 'martin', tipo: 'prompt',
    titulo: 'Las ofertas, atadas a un funnel; el chat igual al de WhatsApp; el diagnóstico adentro',
    pedido: 'Las ofertas deben estar atados a los productos del CRM... Y quiero cambiar el concepto "Producto" por "Funnel" en todos lados... Porque un mismo funnel puede tener varias "ofertas"... Configuralo de esa manera, para que yo pueda seleccionar en que funnel analizar o crear una nueva oferta. Mandale como tarea al CRM que lo cambie en todos lados.\n\nEn la tab de offer, que donde hoy está el título de "Offer" se elimine y ahí se seleccione un funnel, y se pueda crear o analizar una oferta.\n\nY para la funcionalidad de la tab, quiero que aproveches las cosas que ya construimos... Por ejemplo "El diagnóstico" (Que en este caso, las preguntas deben ser más personalizadas y el resultado del diagnóstico no se debe ver al finalizar esas preguntas, pero si ser parte del PDF final). Aprovecha "El archivero", "Avatares", "Razones"...\n\nPuedes ir pidiendole todo por el chat, en el orden que te parezca... Yo creo que si partimos de un documento o un link de su web o landing o algo así, sería mucho más fácil... Pero si no tiene nada o hay cosas que le faltan, como que nunca pensó en una garantía o no tiene claro su avatar, también con preguntas poder ir creando todo.\n\nElimina el botón de "Ofertas anteriores", para eso ya estará el desplegable... Y ese desplegable debe ser modo arbol, como lo hacemos siempre. Primero el paso del funnel y dentro las ofertas que hayan.\n\nQuiero que el diseño del chat se vea exactamente igual a lo que ya creamos... Que tenga ese formato de grabar audio, la animación de grabando audio, adjuntar archivos, imagenes, emojis... Copialo tal cual. Y el que pregunta, que sería MaKo, la foto de perfil que sea la estrella de MaKo, que tiene una sola estrella sin una estrellita pequeña arriba, y el fondo negro.',
    puntos: [
      'El renombre «Producto» → «Funnel» del CRM se le pasó al chat del CRM, que lo hizo el mismo día (f5a98420: cambia sólo el texto que se ve; tablas, claves y firmas quedan igual).',
      'El chat del CRM corrigió el contrato: el «funnel» es una fila de `funnels`, no un producto de `productos`. Ver docs/hallazgos-offer.md.',
    ],
  },
  {
    fecha: '11 oct', hora: '18:19', chat: 'Offer: chat con IA, diagnóstico y PDF', cuenta: 'claude3', actor: 'martin', tipo: 'prompt',
    titulo: 'Una tab en SuperAdmin con el criterio y las conclusiones de los cursos de oferta',
    pedido: 'También quiero que me dejes en SuperAdmin una tab con el criterio y todas las conclusiones que sacaste luego de analizar los cursos que hablan de OFFER, así lo puedo revisar',
    puntos: [
      '«El criterio» se leyó como DOS cosas: lo que dice el marco escrito (docs/offer-marco.md) y lo que el código aplica de verdad; donde no coinciden, la tab lo muestra en vez de elegir uno.',
      '«Todas las conclusiones» no es el volcado de las seis investigaciones (~600 KB): es lo que concluyó cada autor, una idea por fila y con su fuente.',
    ],
  },
  {
    fecha: '11 oct', hora: '19:28', chat: 'Offer: chat con IA, diagnóstico y PDF', cuenta: 'claude3', actor: 'claude', tipo: 'implementacion',
    titulo: 'Offer Playbook: el marco en tabs, lo que corre en el código y lo que concluyó cada autor',
    puntos: [
      'La tab RENDERIZA docs/offer-marco.md partido en seis pestañas (Criterio, Precio y garantías, Errores comunes, Autores, Discrepancias, Fuentes): no hay copia del marco.',
      'Criterio muestra lo que corre de verdad (las 13 piezas y las 9 dimensiones, leídas de lib/offer-marco.ts) y las 13 cosas que el código todavía no aplica del marco, con quién lo resuelve.',
      'Autores: 19 autores y 132 conclusiones, destiladas por 6 agentes y verificadas por otros 6 contra la investigación y la clase citada; tres re-verificadas a mano. Sin citas textuales de los cursos.',
      'El cruce marco ↔ código lo hizo un agente aparte contra HEAD. Lo más serio: el filtro de cifras deja pasar números inventados en el PDF.',
    ],
    archivos: [
      'app/admin/offer-playbook/page.tsx — la tab',
      'app/admin/offer-playbook/secciones.ts — cómo se reparte el marco entre las pestañas',
      'app/admin/offer-playbook/pendientes.ts — lo que el código todavía no aplica',
      'lib/offer-autores.ts — las conclusiones por autor',
      'docs/hallazgos-offer.md — el cruce con archivo:línea',
    ],
  },
  {
    fecha: '11 oct', hora: '20:25', chat: 'Offer: chat con IA, diagnóstico y PDF', cuenta: 'claude3', actor: 'claude', tipo: 'implementacion',
    titulo: 'Offer v2: cada conversación atada a un funnel, el chat de WhatsApp y el diagnóstico de fase adentro',
    puntos: [
      'En el lugar del título, un selector en árbol (el Dropdown de la casa): funnel → sus ofertas → sus conversaciones, con «Nueva oferta» y «Analizar». Se fue «Ofertas anteriores».',
      'El funnel es una fila de `funnels` (lo que dibuja el CRM) y sus ofertas salen de `funnel_ofertas`; «Guardar en este funnel» liga la oferta, y queda como principal sólo si el funnel no tenía ninguna. Migración 0256, aplicada antes del deploy.',
      'El chat usa las piezas de WhatsApp de la casa (ChatHilo, BurbujaHilo, ComposerWhatsApp: audio con su animación, adjuntos, imágenes, emojis) y el avatar de MaKo es la chispa sola sobre negro. La nota de voz se transcribe antes de guardar nada.',
      'Arranca pidiendo un documento o el link de la web; el diagnóstico de fase se pregunta adentro del chat con opciones a medida que mapean a la original, no se muestra y va al PDF.',
      'Revisión adversarial antes de subir (5 revisores + 5 refutadores): 26 hallazgos reales, cero de seguridad, todos arreglados con su test probado rompiéndolo. El más serio: una lista de opciones corrida un lugar guardaba otro rango en el diagnóstico del negocio.',
    ],
    archivos: [
      'app/offer/OfferApp.tsx — la pantalla',
      'app/offer/SelectorFunnel.tsx — el selector en árbol',
      'app/offer/ChatOffer.tsx — el chat con las piezas de WhatsApp',
      'app/api/offer/route.ts — la API (arbol, nueva, turno con audio, leer-link, guardar en el funnel)',
      'lib/offer-reglas.ts — el diagnóstico adentro del chat y el árbol',
      'supabase/migrations/0256_offer_funnel.sql — la conversación atada al funnel',
    ],
  },
  {
    fecha: '12 oct', hora: '01:18', chat: 'Offer: chat con IA, diagnóstico y PDF', cuenta: 'claude3', actor: 'martin', tipo: 'prompt',
    titulo: 'El Playbook más simple y gráfico, una tab «A definir», la columna a la altura del chat y los adjuntos como WhatsApp',
    pedido: '1. Simplifica mucho la tab de super admin... Primero elimina las sub tab de "precio y garantias" y "Fuentes" si para eso ya está la de autores...\n2. Y simplifica mucho, que sea más legible, más facil, más grafico... Utiliza elementos graficos, contendores, tablas, desplegables, o lo que necesites  para que sea facil de entender.\n3. Allí ponme una tab de "A definir" que sea justamente estas 9 correciones o las 4 o las que vayas teniendo... Que esta bien explicado, de manera simple que necesitas que decida.\n4. Con respecto a la tab de offer, la columna de "Tu oferta" debe ser del mismo alto que el chat.\n5. Intenté subir un documento y saltó ese error. No se si apenas lo subí ya lo quiso analizar, eso estaría mal. Solo cuando le doya ENVIAR debería... Sino, debería salir la vista previa del documento que acabo de subir, como lo tiene whatsapp, te envio un ejemplo... Fiajte que se ve la preview, y puedo agregar más documentos... Y aún escribir un mensaje abajo... Quiero que apliques este cambio no solo a offer, sino a todos los chats que consuman esto de subir documento.',
    puntos: [
      'El error («unsupported Unicode escape sequence») era un NUL adentro del texto del PDF, que Postgres no acepta en un jsonb: se arregló en el lector compartido de archivos (lib/texto-para-base.ts), así que lo heredan todos los que leen un archivo.',
      'Sí, Offer leía el documento apenas se elegía (para el ✓ del chip). Se decidió que se lea recién al ENVIAR, detrás de una vista previa como la de WhatsApp que compartan todos los chats (ver el hito de implementación).',
    ],
  },
  {
    fecha: '12 oct', hora: '02:40', chat: 'Offer: chat con IA, diagnóstico y PDF', cuenta: 'claude3', actor: 'claude', tipo: 'implementacion',
    titulo: 'Adjuntar como WhatsApp: la vista previa compartida, y Offer lee recién al enviar',
    puntos: [
      'Un componente para todos los chats (app/whatsapp/_shared/VistaAdjuntos.tsx): el archivo grande (la primera página del PDF, la imagen o su reproductor), la tira de miniaturas con «+» y «×», el mensaje abajo y Enviar.',
      'Offer: elegir no sube ni lee nada; Enviar sube y lee cada uno en orden y recién ahí manda el mensaje. Si una lectura falla, no sale el mensaje y no se releen los ya leídos.',
      'ChatHilo (bandeja de WhatsApp, grupos de MaKo, simulador de Automations): varios archivos a la vez, en orden, con el texto como pie del primero.',
      'El error que lo disparó (un NUL adentro del texto del PDF) ya estaba arreglado en el lector compartido.',
    ],
    archivos: [
      'app/whatsapp/_shared/VistaAdjuntos.tsx — la vista previa',
      'app/offer/adjuntos-envio.ts — leer al enviar, en orden y sin releer',
      'app/whatsapp/_shared/ChatHilo.tsx — varios adjuntos en los chats de WhatsApp',
    ],
  },
  {
    fecha: '12 oct', hora: '05:48', chat: 'Offer: chat con IA, diagnóstico y PDF', cuenta: 'claude3', actor: 'martin', tipo: 'prompt',
    titulo: 'Las 13 tarjetas de «A definir», contestadas',
    pedido: '1. A\n2. A\n3. B, nadie dijo que no la pudiesen pagar...\n4. A\n5. A, y también falta lo de escalera de valor...\n6. A, y siempre debe preguntar si tiene más ofertas... Para poder determianr si tiene muchas ofertas solo que no las analizó en MaKo.\n7. A\n8. A\n9. A\n10. A\n11. A\n12. C, y sería bueno que MaKo en el mismo chat te proponga pulir la oferta, y que cuando se haya pulido te re-envie el PDF las veces que sea necesario con la versión final...\n13. A',
    puntos: [
      '1 cifras inventadas: arreglar · 2 «lista» con el control final · 3 garantía: se queda como está (con casos ya puede ser fuerte; «nadie dijo que no la pudiesen pagar») · 4 notas con los números del marco · 5 las cuatro preguntas, y además la escalera de valor · 6 los avisos (margen, dónde se cortan las ventas, cuándo subir el precio), y preguntar SIEMPRE si vende otras ofertas aunque no estén en MaKo · 7 foco desde 3 ofertas · 8 reglas de cobro a la IA · 9 topes de las listas.',
      '10 el PDF separa en una lista al final lo que propuso MaKo · 11 la prueba (cuántos pagaron y cuántos lograron el resultado) pasa a mínima, con el «no sé» como supuesto · 12 con cliente o promesa en 3 o menos se entrega todo con precio y bonos PROVISIONALES, y MaKo propone pulir la oferta en el mismo chat y reenvía el PDF de cada versión las veces que haga falta · 13 MaKo revisa en código las reglas que hoy sólo dependen de la IA.',
    ],
  },
  {
    fecha: '12 oct', hora: '07:16', chat: 'Offer: chat con IA, diagnóstico y PDF', cuenta: 'claude3', actor: 'claude', tipo: 'implementacion',
    titulo: 'Las 13 decisiones, aplicadas: «A definir» queda vacía',
    puntos: [
      'Las cifras se comparan por VALOR («1.500», «1,5 mil» y «1.5k» son lo mismo); lo que el negocio no dio queda «[completar]» y lo que propuso MaKo va a su propia lista del PDF.',
      'El control final decide «lista para vender»; el PDF de cada versión entra al chat en la misma escritura que la versión, y «Pulir la oferta» vuelve a armarla las veces que haga falta.',
      'La garantía (3 → B) no cambió en el código: cambió el marco. Un test fija que ningún texto que lee la IA pida «10 a 15 casos».',
    ],
    commits: [{ sha: '8e053fd', msg: 'Offer: las 13 decisiones de Martín sobre el criterio, aplicadas (cifras, control final, pulir y reenviar el PDF)', lineas: 2310, archivos: 28 }],
    archivos: [
      'lib/offer-reglas.ts — cifras, control final, avisos y lo provisional',
      'app/admin/offer-playbook/pendientes.ts — las 13 pasan a «Decididas»',
    ],
  },
  {
    fecha: '13 oct', hora: '—', chat: 'Reunión con Martín (Fathom 858545195)', cuenta: 'claude2', actor: 'martin', tipo: 'prompt',
    titulo: 'La voz de marca en el Offer Generator',
    pedido: 'Una configuración de voz de marca y tono personalizado en el Offer Generator, para evitar que los textos generados suenen genéricos, corporativos o desconectados del nicho.',
    puntos: [
      'Salió de una reunión (minuto 44:56) y se validó en el chat el 13/10; la hora no consta. Se frenó el 14/10 por el cierre de la cuenta 2 («por ahora quiero que se pushee todo»).',
      'El relevamiento: la voz ya existía y la usaban seis features; Offer era la única afuera. No hacía falta una configuración nueva.',
    ],
  },
  {
    fecha: '13 oct', hora: '23:03', chat: 'Offer', cuenta: 'claude2', actor: 'claude', tipo: 'implementacion',
    titulo: 'Los cuatro pendientes frenados, cerrados; el quinto espera a Martín',
    puntos: [
      'La oferta guardada se liga a su producto con la misma regla que el seed del brief; un link con «?page_id=» se lee tal cual; el audio no se re-sube al reintentar; «guardar si no hay» vive en el store de la fase.',
      'El Archivero desde el chat NO se cerró: Offer borra el binario al leerlo, y cerrarlo de verdad es guardarlo y pagar una extracción por documento. Es una decisión de Martín.',
    ],
    commits: [{ sha: '077673c', msg: 'Offer: los cuatro pendientes que estaban frenados, y por qué el quinto no se cierra solo', lineas: 503, archivos: 13 }],
  },
  {
    fecha: '14 oct', hora: '04:03', chat: 'CRM', cuenta: 'claude2', actor: 'claude', tipo: 'implementacion',
    titulo: 'La oferta del lead, y «Analizar oferta →» abre ESA oferta en Offer',
    puntos: [
      'La ficha del lead elige o crea su oferta (leads.oferta_id, mig 0272) y la manda a analizar; /offer?oferta=&funnel= abre la conversación de esa oferta, o una nueva.',
    ],
    commits: [
      { sha: '81a28c1', msg: 'Pagos del lead: la oferta arriba, con «Nueva oferta» y «Analizar oferta →»', lineas: 435, archivos: 8 },
      { sha: '4ca15b9', msg: 'Offer abre la oferta que nombra el link: «Analizar oferta →» del lead cae en ESA', lineas: 86, archivos: 5 },
    ],
  },
  {
    fecha: '15 oct', hora: '00:48', chat: 'Offer', cuenta: 'claude1', actor: 'claude', tipo: 'correccion',
    titulo: '«Cierras el 170%»: el cierre que se afirma nunca pasa de 100%',
    puntos: [
      'Medido en prod: la única oferta armada por un cliente (12/10) decía «Cierras el 170% de las llamadas calificadas» y le aconsejaba subir el precio. Con asistencias sin calificar, «calificados» es un piso.',
      'Ahora se afirma el número exacto sólo sin asistencias sin marcar; si no, el piso (sobre todas las llamadas) para «más de 30%» y el techo para «menos de 25%». Lo ya guardado se filtra en el PDF, la pantalla y la API.',
    ],
    commits: [{ sha: 'db81f96', msg: 'Offer: el cierre nunca pasa de 100%, MaKo lee las ofertas por WhatsApp y la oferta sale en la voz del negocio', lineas: 428, archivos: 16 }],
    archivos: [
      'lib/offer-reglas.ts — `cierreConfiable`, `alertasPrecio`, `alertasEmbudo`',
      'lib/offer-marco.ts — `avisosAfirmables`, para lo ya guardado',
    ],
  },
  {
    fecha: '15 oct', hora: '00:48', chat: 'Offer', cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'Offer en la API de MaKo, y la oferta en la voz del negocio',
    puntos: [
      'MaKo por WhatsApp lee las conversaciones de Offer y la última oferta armada (listar_analisis_oferta, ver_analisis_oferta): gratis, sin http, con la tab y el rol de la página.',
      'La voz: la guía destilada del Chat Agent o, si no hay, la marca declarada. Entra por el slot {{voz}} en el turno y en la oferta (no en el diagnóstico), aparte del contexto que se recorta.',
    ],
    commits: [{ sha: 'db81f96', msg: 'Offer: el cierre nunca pasa de 100%, MaKo lee las ofertas por WhatsApp y la oferta sale en la voz del negocio', lineas: 428, archivos: 16 }],
    archivos: [
      'lib/api-mako/areas/negocio.def.ts + negocio.run.ts — las dos lecturas',
      'lib/nutricion-generator.ts — `vozDelNegocio`',
      'lib/offer-ia.ts — el slot {{voz}} en el turno y en la oferta',
    ],
  },
  {
    fecha: '15 oct', hora: '05:32', chat: 'Ticketera', cuenta: 'claude3', actor: 'martin', tipo: 'prompt',
    titulo: 'El Archivero desde el chat: guarda el archivo y paga una extracción',
    pedido: '¿El Archivero del chat guarda el archivo y paga una extracción por documento? → A · Sí',
    puntos: [
      'Estaba preguntada desde el 13/10 (ref `offer-archivero`): Offer borraba el binario apenas lo leía, su IA saca piezas de la oferta y no campos del brief, y la tab prometía que nada pagaba. Con «A · Sí», cada archivo se conserva y paga UNA extracción de campos.',
    ],
  },
  {
    fecha: '15 oct', hora: '23:50', chat: 'Offer', sesion: 'local_34d54ef6-523c-46f8-b83f-9fd310dfd667', cuenta: 'claude3', actor: 'claude', tipo: 'implementacion',
    titulo: 'Cada archivo del chat queda también en El Archivero',
    puntos: [
      'Con el documento ya en la conversación, el binario pasa POR DETRÁS a El Archivero (`registrarDocumentoSinPisar`): queda en `<ws>/<id>` con la MISMA extracción que hace su pantalla, sobre el texto que Offer ya leyó. El chat no espera; si falla, el chip del archivo dice por qué.',
      '⚠️ **Mirar si la fila existe no alcanza para pagar una sola vez**: la extracción tarda segundos y dos envíos del mismo archivo se pisaban. El id sale del CONTENIDO y el lugar se gana MOVIENDO el binario antes de extraer; mover es atómico y no pisa.',
      'No recalcula el brief (`buildEstado(true)` se llevaba lo del wizard): suma sólo las claves de ese documento, y un test lo compara contra `computeEffective` de verdad. Sin panorama (sería otra llamada paga) y sin audios ni links (no son archivos del negocio).',
      'El gasto va como «El Archivero» con el motivo «Offer → El Archivero: …», así la medición por documento del Pricing sigue valiendo. 13 tests, 30 roturas cazadas.',
    ],
    // El commit se rebasó antes de subir: era 718e00b en su worktree y en main es f4ed5e0.
    commits: [{ sha: 'f4ed5e0', msg: 'Offer: cada archivo del chat queda también en El Archivero, con una extracción por documento', lineas: 812, archivos: 12 }],
    archivos: [
      'lib/archivero.ts — `registrarDocumentoSinPisar` y `reclamarLugar`',
      'lib/archivero-registro.ts — lo puro: el id de contenido, el «sin pisar», el binario huérfano',
      'app/api/offer/route.ts — `leer` entrega el binario; `archivarDespues` y `anotarArchivero`',
      'lib/offer-reglas.ts — `seArchivaDesdeOffer`, `conArchivero` y los saneos que lo conservan',
    ],
  },
  {
    fecha: '12 oct', hora: '—', chat: 'Llamada con Leila (Fathom)', cuenta: 'claude3', actor: 'martin', tipo: 'prompt',
    titulo: 'El chat de Offer no se va nunca',
    pedido: 'yo de hecho quisiera que jamás se salga el recuadro del chat. O sea, si vos querés seguir afinando, le vas escribiendo ahí en el mismo chat… nunca se salga como, de última que haya como una preview de un pop-up, por ejemplo, o algo así donde vos puedas ver lo que te mandó, pero que nunca se sale el recuadro del chat',
    puntos: [
      'Lo dijo en la llamada con Leila del 12/10 (Fathom, 00:42:47), mirando la pantalla de la oferta que reemplazaba al chat. A los 00:37:00, sobre la pantalla de carga: «en lugar de que cambie el chat, que siga manteniendo el mismo chat pero que MaKo te envíe un mensaje diciéndote ya estoy trabajando».',
      'No había quedado escrito en ningún lado del repo: lo encontró una búsqueda en la transcripción de Fathom el 16/10.',
    ],
  },
  {
    fecha: '16 oct', hora: '05:07', chat: 'Offer', sesion: 'local_34d54ef6-523c-46f8-b83f-9fd310dfd667', cuenta: 'claude3', actor: 'claude', tipo: 'implementacion',
    titulo: 'El chat no desaparece, y Offer es el onboarding',
    puntos: [
      'Armar la oferta es un mensaje más del hilo, con sus dos pasos y su reintento; la oferta se ve en una ventana ENCIMA del chat, desde «Ver mi oferta» del PDF o del riel. Ya no hay vistas que reemplacen al chat.',
      'El mismo motor es el onboarding de MaKo (modo `arranque` de OfferApp): la conversación de la oferta nace en el funnel principal y alrededor van las preguntas del arranque.',
      'El crédito de Claude de la plataforma entra en `pedir` antes de la red gratis, sólo mientras el onboarding esté pendiente (lo habilita la lista de lib/veto-claude.ts).',
    ],
    commits: [
      { sha: 'dbbabfe', msg: 'Offer: el crédito de Claude de la plataforma, antes de la red gratis, para cuando Offer sea el onboarding', lineas: 60, archivos: 2 },
      { sha: 'dd3b650', msg: 'Onboarding: el arranque es el chat de Offer, con MaKo de foto de perfil; y el chat de Offer ya no desaparece', lineas: 4973, archivos: 34 },
    ],
    archivos: [
      'app/offer/OfferApp.tsx — sin vistas que tapen el chat; la Conclusión en un Modal; el modo arranque',
      'app/offer/ChatOffer.tsx — `armando` en el hilo, «Ver mi oferta» en el PDF, avatar y tarjetas enchufables',
      'app/offer/Generando.tsx — `GenerandoEnChat`, el armado adentro de una burbuja',
      'lib/offer-ia.ts — el crédito de Claude antes de la red gratis',
    ],
  },
];

export const PARTES: Parte[] = [
  // ── Hecho ────────────────────────────────────────────────────────────────
  { titulo: 'F0 · El paso de Productos cierra', detalle: '`PASOS_ONBOARDING` como fuente única (tipo + estado + validación del endpoint salen de ahí) y el wizard mira `ok`. Verificado: paso válido → 200 y persiste, paso inventado → 400', estado: 'hecha' },
  { titulo: 'F0 · La IA completa, no pisa', detalle: 'Merge campo a campo en la ruta + el producto ENTERO al modelo + dedup por nombre normalizado. Verificado con dos corridas reales: sobre un producto completo no cambia un solo campo', estado: 'hecha' },
  { titulo: 'F0 · El catálogo entra a los tres catálogos', detalle: '`productos` en reset-workspace (un reset ya no arrastra las ofertas del ws anterior), clonar-config (clave natural configurable) y datos-mau como lugar propio. Más `seedProductosDesdeOferta()` por fin llamada y `orden` por fin escrito', estado: 'hecha' },
  { titulo: 'F0 · /email deja de escribir para Mauricio', detalle: 'Era una fuga de contenido cross-tenant VIVA: el system tenía la oferta y el Calendly del dueño hardcodeados para todos los workspaces. Ahora sale del perfil/voz/funnel del workspace y es editable desde /configuraciones', estado: 'hecha' },
  { titulo: 'El modelo y los conteos', detalle: 'Cuatro entidades decididas con las respuestas del dueño, DDL de 0125 a 0131 escrito, y las cinco queries de verificación corridas contra prod. Ver docs/modelo-oferta-producto-funnel.md', estado: 'hecha' },

  // ── Lo que sigue, en orden de dependencia ────────────────────────────────
  // El `titulo` se pinta plano a propósito (Registro.tsx:54): es un renglón de índice,
  // no prosa. El código va en el detalle.
  { titulo: 'F1 · La tabla funnels (mig 0170, la 0126 del doc)', detalle: 'ESCRITA el 26/09, sin aplicar todavía. Copia no destructiva de `funnel_config` (6 filas hoy, no 4: el doc se escribió en agosto) + una fila `declarado=false` para los 3 workspaces sin funnel; `funnel_config` queda intacta de respaldo. El rename `getFunnel()`→`getFunnelDefault()` rompió la compilación a propósito y los 33 call-sites quedaron decididos uno por uno entre el del NEGOCIO y el del LEAD (`getFunnelDeLead`). `grep funnel_config` ya solo devuelve migraciones e historia, con un test que lo fija. ⚠️ La migración se aplica ANTES o JUNTO con el deploy, no después.', estado: 'hecha' },
  { titulo: 'F2 · Las OFERTAS (migs 0169 + 0171, las 0125/0127 del doc)', detalle: 'HECHA el 26/09, con las migraciones ESCRITAS y SIN APLICAR. La entidad con bonos, urgencia (chip cerrado y con fecha aparte, no un textarea, para que se pueda verificar en código y no sólo afirmar), prueba, objeciones y para quién. ⚠️ OJO CON ESTA: `urgenciaUsable()` existe y está testeada, pero NO LA LLAMA NADIE todavía — el catálogo de `lib/guion-angulos.ts` es una constante estática y ninguno de sus consumidores lee la oferta, así que «sin restricción real el ángulo no se usa» sigue siendo prosa de prompt. Lo que quedó hecho es el campo y la función; falta el call-site. `oferta_productos` y `funnel_ofertas` son los dos N:M, y producto↔funnel se DERIVA en la vista `v_funnel_productos` — no hay tercera tabla que mantener sincronizada. El grupo `oferta` del brief NO se copia: la fila nace con los 5 campos en NULL y `desde_brief=true`, y `ofertaPrincipal()` los resuelve del blob; el único lector que cambió es `perfilNegocioTexto()`, que de paso dejó de emitir el label-PREGUNTA a ~20 features. Se carga en el paso `productos` del onboarding (corrección explícita del dueño: NO en Configuraciones) y se ve también en /second-brain → área Oferta. El alta va de a una pregunta por pantalla con `WizardShell` usando el MAPA (`pasos`+`pasoActual`), porque tiene rama', estado: 'hecha' },
  { titulo: 'F3 · Paso 0 — el choke point de escrituras', detalle: 'Hoy hay ≥32 escrituras a `leads` en 15 archivos (12 solas en app/crm/actions.ts). Se colapsan en `lib/participaciones.ts` + `lib/participaciones-modelo.ts` (sin `server-only`, para que un test pueda importar `COLUMNAS_ESPEJO`). Con una sola participación por lead es refactor puro y reversible. **Va ANTES de la migración**, o el espejo se desincroniza por el camino que nadie migró y el síntoma aparece días después en otra pantalla', estado: 'cola' },
  { titulo: 'F3 · Las participaciones (migs 0128-0129)', detalle: 'Un lead × un funnel × un INTENTO. `leads` pasa a ser el espejo de la activa. Incluye el paso `producto` del wizard Ganado con sus tres trampas: condición de faltante propia (nunca colgada de `monto`), pedirlo solo AL ENTRAR a la etapa, y cablear los 4 constructores de `MoveLeadInfo` (hoy el prefill está declarado y ninguno lo setea)', estado: 'cola' },
  { titulo: 'Release-gate · lo que no se puede diferir', detalle: 'Cinco cosas que producen datos FALSOS, no vacíos, y por eso van en el MISMO release que habilite la 2ª participación: `nutricion_secuencias.funnel_id` (o dos funnels se cruzan mensajes REALES), `etapa_vista` por participación (o la pasada masiva escribe historial inventado firmado por MaKo), `lead_audit.participacion_id`, los dos guards que impiden reactivar dos veces al mismo lead, y `encuentroGrabable()` recibiendo el canal del funnel', estado: 'cola' },
  { titulo: 'F5 · El contrato de la IA', detalle: '`lib/oferta-contrato.ts` (sin `server-only`) + `lib/oferta-contexto.ts`. Hoy el mismo bloque de funnel está copiado TRES veces más `resumenFunnel()`; con N funnels eso se vuelve incorregible. La unidad de contexto es el par (oferta, funnel)', estado: 'cola' },
  { titulo: 'F6 · Reportes por oferta y por funnel', detalle: 'En vistas NUEVAS que no se suman con las de siempre — meter la dimensión en el GROUP BY de `v_cohortes_*` rompe su shape y hace que `cohortes_maduras_count` cuente semana × funnel sin ningún error. Y lo que NO se puede cortar por funnel se dice en pantalla: el spend de Meta no tiene atribución, así que filtrar solo la salida da un porcentaje falso', estado: 'cola' },

  // ── Fuera de alcance, dicho a propósito ──────────────────────────────────
  { titulo: 'Assets por producto (#210)', detalle: 'Landing/VSL/anuncios por producto. El `funnel_id` en las tablas que ya existen entra en el release-gate, pero la GESTIÓN de assets es proyecto propio. Ojo: #210 está en el board bajo «Vender MaKo: Landing y VSL», que es el marketing de MaKo y no el del cliente', estado: 'cola' },
  { titulo: 'Ruteo automático al funnel', detalle: 'La tabla `activos` con match por `meta_ad_id`/UTM/instancia de WhatsApp. Es el modelo correcto a dos años, pero pedirle al cliente que tipee ids de anuncios es la config manual que venimos sacando: cuando entre, el sistema mira lo que YA llega en los leads y propone «estos anuncios están entrando a este embudo, ¿lo confirmás?»', estado: 'cola' },
  { titulo: 'Un deal con DOS productos', detalle: 'Irrepresentable hoy y se deja así: un lead tiene un `monto_cierre_usd` y las cuotas de `pagos` no referencian producto. La puerta futura es `pagos.participacion_id` (0129) y después `producto_id`, no una tabla puente que nadie consumiría', estado: 'cola' },
  { titulo: 'Una tercera reunión en un mismo intento', detalle: '`slotPorIndice` devuelve DOS slots y nada más. Dos participaciones dan cuatro reuniones, pero un BOFU con tres pasos (discovery + demo + cierre) adentro de un intento sigue sin tener dónde guardar la tercera. Necesita una tabla `reuniones` y no entra acá', estado: 'cola' },
];
