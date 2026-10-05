// =============================================================================
// Chatbot (Chat Agent) — el registro de construcción del área
// =============================================================================
// El Chat Agent: las secuencias de nutrición, el motor que las manda, el
// onboarding de la tab, el ensayo con MaKo haciendo de lead y el hand-off al
// humano. Vive en app/chat-agent/, lib/nutricion.ts, lib/setting-estrategia.ts,
// lib/evolution-envio.ts y lib/setting-simulador.ts.
//
// NO es un changelog: el changelog ya está en `git log`. Acá va lo que git no
// guarda — qué pidió el dueño con SUS palabras, qué se entendió, y sobre todo
// cuándo el diagnóstico obvio era el equivocado.
//
// De dónde salió cada cosa:
//   fecha/hora + commits  `git log --date=format:'%d %b %H:%M' -- app/chat-agent/ …`
//   chat                  docs/chats.md (el índice de las 48 sesiones)
//   pedido                los mensajes textuales del dueño, sin parafrasear
//   puntos                docs/hallazgos-comunicacion.md (las trampas y lo que falta)
//
// Se agrega AL FINAL del array (orden cronológico). La pantalla lo lee al revés.

import type { Hito, Parte } from '../_registro/tipos';

/** Los títulos reales de las sesiones. El índice completo, en docs/chats.md. */
const CH_VSL = 'Tracking del VSL y el inbox de WhatsApp';
const CH_EMAIL = 'Email Marketing y WhatsApp no oficial';
const CH_AGENT = 'Chat Agent: onboarding, nutrición y datos de Mauricio';

export const PARTES: Parte[] = [
  { titulo: 'El motor de nutrición', detalle: 'Cohortes por trigger · cadencia · guards anti-ban · dry-run primero', estado: 'hecha' },
  { titulo: 'Los tres canales', detalle: 'WhatsApp oficial (Chatwoot+Meta) · no oficial (Evolution) · email (Resend)', estado: 'hecha' },
  { titulo: 'La tab: secuencias y prueba en vivo', detalle: 'Secuencias como contactos · wizard · simulador WhatsApp/Email/Dashboard', estado: 'hecha' },
  { titulo: 'Onboarding de la tab', detalle: 'Conectar → Contexto → Ensayo · lo aburrido al final · su estado alimenta a MaKo', estado: 'hecha' },
  { titulo: 'El ensayo', detalle: '9 escenarios con título · MaKo hace de lead · concluye, no objeta para siempre', estado: 'hecha' },
  { titulo: 'Objetivo, desenlace y hand-off', detalle: 'La secuencia sabe cuándo terminó · encadena a la siguiente · si el lead se sale del guion, MaKo se calla', estado: 'hecha' },
  { titulo: 'Go-live: que el motor mande de verdad', detalle: 'Flags apagados · el fallo que no avanza ni reagenda · qué hacer con el paso del canal apagado', estado: 'sigue' },
  { titulo: 'La prospección acordada con Mauricio', detalle: 'Audio como primer toque · lead magnet como archivo · presupuesto anti-ban propio', estado: 'cola' },
  { titulo: 'El flujo, en un lienzo', detalle: 'La secuencia como grafo: se dispara → los mensajes → si contesta → desenlace → «sigue con» otra secuencia · las aristas salen del DATO (orden, `requiere`, `logradoSecuencia`), nadie configura flechas · tocar un nodo lo edita ahí mismo · reemplazó a las tres sub-tabs', estado: 'hecha' },
  { titulo: 'Chat Analyst', detalle: 'Métricas de cómo responde el bot · era la otra mitad de «Editor de flujos + Chat Analyst», que quedó frenado desde el 15/07 esperando la guía del dueño — la guía llegó el 30/09 como una captura de ManyChat', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  {
    fecha: '30 sep', hora: '00:20', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'El flujo de conversación, como el editable de ManyChat',
    pedido: 'Quiero que los editables del flujo de conversación sea como el editable de Manychat, que tiene una pantalla tipo flujo, y ahí se edita todo. Investigalo a profundidad e implementalo.',
    puntos: [
      'Vino con una captura del Flow Builder de ManyChat: lienzo infinito, nodos conectados por curvas, «Tap some step to edit», y la cabecera con Saved / Preview / Publish.',
      'Cierra la mitad que quedó frenada el 15/07: aquel día se construyó el editor «dibujado» por pasos y él lo mandó revertir 42 minutos después, «punto de partida para rediseñarlo juntos con su guía». La guía era esto.',
    ],
  },
  {
    fecha: '30 sep', hora: '03:10', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'Cinco relevos, cinco refutados: el flujo de conversación no era el que se llama «flujo»',
    puntos: [
      'El pedido nombra una pantalla que no existe: «flujo de conversación» tiene CERO coincidencias en app/ y lib/. Hay siete cosas que modelan pasos y dos se llaman «flujo».',
      'Medido en producción: el que se llama «Flow Editor» tiene 4 flujos con 0 pasos; `nutricion_secuencias` tiene 62 secuencias, 136 pasos y ramas que el motor ejecuta de verdad. El candidato se eligió por las filas, no por el nombre.',
      'Los cinco relevos volvieron refutados y las refutaciones cambiaron el plan: el primero apuntaba al modelo vacío, y el que decía «no hay nada que dibujar» estaba mirando el motor que no importa.',
      'El hallazgo incómodo: el pedido contradice una decisión suya versionada — el canvas drag-to-connect del funnel se construyó (14 etapas, 24 flechas), lo llamó «rebuscado», y la memoria lo guarda como «lista/forms, no canvas». Se resolvió separando QUÉ de CÓMO: lo rebuscado era configurar flechas.',
      'Y el tamaño que decidió el diseño: la secuencia más grande de toda la base tiene TRES pasos. Por eso el layout se calcula y no se guarda.',
    ],
    archivos: ['docs/hallazgos-comunicacion.md — las cinco entradas de esta tanda'],
  },
  {
    fecha: '30 sep', hora: '05:40', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El lienzo: la secuencia como grafo, y se edita tocando un nodo',
    puntos: [
      'Nodos: se dispara → los mensajes (la burbuja REAL de WhatsApp, con su audio reproducible) → si contesta → qué pregunta → el desenlace con sus DOS puertos → «sigue con» otra secuencia. Tocar cualquiera abre su editor encima del lienzo, que es literalmente lo que hace ManyChat.',
      'Las aristas salen del dato: el orden de los pasos, `delay_horas`, `requiere`, y `logradoSecuencia`/`falloSecuencia`. Nadie conecta nada — y el encadenamiento con otra secuencia, que NINGUNA pantalla mostraba, ahora se ve y lleva.',
      'Reemplazó a las tres sub-tabs (Estrategia / Mensajes / Variantes) y a `MensajesChat`. No conviven: dos editores del mismo jsonb divergen, que es la razón escrita por la que se borró el editor de diagramas del funnel dos días antes.',
      'Lo que el lienzo NO edita y por qué: el gancho, las preguntas y el criterio son lo que MaKo DICE, no la forma del flujo; editarlos es decidir siete cosas juntas y para eso está el wizard, un paso por pantalla.',
      'El lienzo no puede mentir: `requiere: sin_respuesta` está en 7 pasos de producción y el motor no lo evalúa, así que se dibuja «sale siempre» con su marca en vez de una bifurcación que no ocurre. Lo ata un guard que lee las condiciones de la fuente del motor.',
      'Verificado en el navegador desde un worktree limpio (el clon compartido no compilaba por trabajo en curso de la otra sesión): abre, el nodo refleja lo que se escribe, la flecha refleja el tiempo, el paneo y el zoom andan, y el panel no tapa el nodo que se está editando.',
    ],
    archivos: [
      'lib/flujo-conversacion.ts — el grafo y su layout, puro y testeable',
      'app/chatbot/FlujoLienzo.tsx — el lienzo y el editor por nodo',
      'app/chatbot/SecuenciaPerfil.tsx — las tres sub-tabs se fueron',
      'tests/flujo-conversacion.test.ts — 20 guards, tres probados rompiéndolos',
      'AGENTS.md — la regla: un lienzo dibuja una afirmación',
    ],
  },
  // ── Junio: el motor, antes de que existiera la tab ──────────────────────────
  {
    fecha: '22 jun', hora: '14:55', chat: CH_VSL, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'El motor de nutrición, primero en seco y después de verdad',
    puntos: [
      'Nació **en dry-run a propósito**. Un motor que manda WhatsApp a leads reales no se prueba en producción: no hay staging para mensajería, probar es mandar de verdad.',
      'La cadencia no la elegimos nosotros: Meta cuenta **2 plantillas MARKETING por usuario cada 24 h sumando a TODAS las empresas**, así que tres toques de marketing en un día no llegan aunque tu cuenta esté verde. Y desde oct-2025 el tier de envío es del **Business Portfolio**, no del número: sumar números al mismo BM no suma capacidad.',
      'Por eso la reactivación se decidió **por goteo** con tope de X mensajes cada X horas: `HS_MIN_ENTRE_MSGS` y `MAX_POR_CORRIDA` son la expresión de esa decisión, no un detalle de implementación.',
      'Al día siguiente se cableó el envío por Chatwoot y se completaron los **11 triggers que faltaban** de `leadsDeCohorte` (había dos: `instant_form_sin_agenda` y `vio_vsl_sin_agendar`).',
      '⚠️ **Un 200 de Chatwoot NO es una entrega.** `sendWhatsappTemplate` devuelve `{ok:true}` en cuanto Chatwoot acepta; el rechazo de Meta (plantilla no aprobada, pausada, variables que no calzan) llega asincrónico y solo aparece como `status=\'failed\'` en el hilo de Chatwoot — **nunca en `nutricion_envios`**, que ya escribió «enviado» y avanzó la inscripción. Sigue igual: el contador de enviados miente.',
    ],
    commits: [
      { sha: '91da927', msg: 'feat(nutricion): Hito 0 — motor de nutrición del VSL funnel (dry-run)', lineas: 454, archivos: 4 },
      { sha: '767bf0e', msg: 'feat(nutricion): envío real por WhatsApp (Chatwoot) + rate-limiter anti-baneo', lineas: 156, archivos: 2 },
      { sha: 'c61e389', msg: 'feat(whatsapp): tab real — inbox de Chatwoot + secuencias de nutrición', lineas: 438, archivos: 4 },
      { sha: '2a7609c', msg: 'feat(nutricion): cohortes para los 11 triggers restantes', lineas: 152, archivos: 1 },
    ],
    archivos: [
      'lib/nutricion.ts — el motor: `leadsDeCohorte`, `procesarEnvios`, `PasoSecuencia`, estados enviado/simulado/omitido/borrador/fallo',
      'supabase/migrations/0034_nutricion.sql — `nutricion_secuencias` / `inscripciones` / `envios`',
      'lib/chatwoot.ts — `sendWhatsappTemplate`, `ensureTemplateSynced`',
    ],
  },
  {
    fecha: '24 jun', hora: '02:11', chat: CH_VSL, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'Terminar la tab de secuencias, con las reglas de Meta adentro',
    pedido: 'Y luego vamos a terminar la tab de secuencias, quiero que:\n\n1. Te investigues y bajes toda la data que existas que porque Meta acepta o rechaza esos mensajes. Y que al editar MaKo me de una valoración de si mi mensaje será aceptado o rechazado.\n2. También aparte de la valoración por mensaje, sería bueno tener el botón de MaKo cargado con esa info de los mensajes y de las reglas de Meta, para poder preguntarle cosas... Por ejemplo "MaKo, se me ocrrió hacer una secuencia de nutrición así... que opinas?"\n3. Quiero poder enviar las solicitudes de aprobación de mensajes directo desde la app, con un botón que pida confirmación y que envíe esa solicitud a Meta.\n4. Como se va a gestionar todo desde la app, quiero poder ver el status de esas solicitudes de aprobación, y poder filtrar entre borradores y los que ya están aprobados.\n5. También sería bueno filtros por etapas, para poder visualizar las secuencias para cada caso',
    puntos: [
      'De acá salió la **rúbrica de aprobación de Meta**, y con ella el hallazgo más caro del frente: **18 de las 29 plantillas de `docs/nutricion-templates.md` arrancan literal con `{{nombre}}`, que es rechazo automático** — el body no puede empezar ni terminar con una variable.',
      'Tres errores que se confunden entre sí y no se arreglan igual: **error 100** = `{{1}}` con `parameter_format: NAMED` (sintaxis posicional mezclada con nombrada); **132000** = Chatwoot no conoce la plantilla recién creada, se destraba con `POST /inboxes/{id}/sync_templates`; **131049** = límite de ENTREGA de Meta por frecuencia de marketing, y no se toca desde el formato.',
      'Decisión que quedó: las plantillas son **referencia para MaKo, no moldes fijos**. Si fueran moldes no tendría sentido usar IA — la libertad es de redacción, los bloqueantes de aprobación siguen siendo rígidos.',
    ],
  },

  // ── Julio: los tres canales y el sistema híbrido ────────────────────────────
  {
    fecha: '9 jul', hora: '16:05', chat: CH_EMAIL, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'Sistema híbrido: opción A, y el onboarding aparte por tab',
    pedido: '1. Si claro, utilicemos la opción A.\n2. Debemos configurar bien el onboarding, tampoco quiero que sea full engorroso el onboarding inicial, y que sea eterno. Lo que se me ocurre, que el usuario al abrir por primera vez las tabs de "WhatsApp" o "Email Marketing" allí te pida toda la configuración, como que sea un onboarding aparte…\n3. También te envío un pdf con como pienso los sistemas de nutrición, en este caso también debemos utilizar el método NO oficial, así que habrá que integrarlo a la app. No tengo idea como.\n4. Revisa la conversación que estamos teniendo con el "Doer vs Thinker", quiero que todo esto sea modo "doer"… lo primero que se me ocurre, es que MaKo te arme automáticamente todos los mensajes de nutrición… Que siga el lenguaje y estilo de comunicación del cliente, que lo saque de todas las transcripciones de ads que ya tenemos…',
    puntos: [
      'La **opción A** son tres números: personal / empresa no oficial / bot oficial por Chatwoot. Con ella vino la regla dura que gobierna todo el motor: **a un lead caliente nunca hay envío automático por el canal no oficial** — se deja un BORRADOR para mandar con un clic. Automático directo, solo a clientes que ya pagaron.',
      'El punto 2 es el germen de la fase «Onboarding de la tab»: en vez de alargar el onboarding principal, cada tab pide lo suyo la primera vez que entrás. Un mes después eso pasó a ser regla del producto para TODAS las tabs.',
      'El punto 4 («que MaKo arme los mensajes en la voz del cliente») es lo que después se llamó F3, y es el motivo por el que el motor todavía no manda: falta destilar esa voz.',
    ],
  },
  {
    fecha: '9 jul', hora: '19:23', chat: CH_EMAIL, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'Los tres canales, multi-workspace, y la cola de borradores',
    puntos: [
      'F1 sacó el motor de owner-only: flags por workspace, dominios de Resend por cliente y crons por inquilino. F2.3 metió Evolution como proveedor con una abstracción de canal, y F3.3 el toggle oficial/no-oficial por PASO.',
      '⚠️ **El único hueco por donde un no-pagador recibe auto-send:** `esLeadCliente` es `estado_lead === \'ganado\' || !!fecha_primer_pago`, con un docstring que dice «pagó». El propio motor demuestra que no: la cohorte `confirmado_sin_pago` selecciona justamente leads `\'ganado\'` con `fecha_primer_pago IS NULL`. Ese lead —el recién confirmado, el más caliente— se va por `enviarYEspejar` en vez de `crearBorrador`.',
      '⚠️ **`enviarBorrador` es check-then-act.** SELECT → guard `estado !== \'pendiente\'` → enviar → marcar. La ventana entre lectura y escritura es de **segundos**, porque `enviarTexto` bloquea el HTTP durante todo el delay anti-ban (hasta 10,8 s): dos setters sobre la misma cola pasan los dos el guard y el lead recibe el WhatsApp duplicado — el patrón de spam que la feature existe para evitar. El arreglo es un claim atómico.',
      'Trampa del entorno: `evFetch` llama a `fetch()` **sin `AbortSignal`**, y el cron recorre todos los workspaces en serie: un solo socket trabado se come la corrida y mata de hambre a los workspaces siguientes.',
    ],
    commits: [
      { sha: '1457ace', msg: 'feat(email): F1 multi-workspace — flags por ws, dominios Resend por cliente y crons por tenant', lineas: 1088, archivos: 12 },
      { sha: '615c267', msg: 'feat(whatsapp): F2.3 — envío no oficial (Evolution) + provider abstraction + borradores', lineas: 408, archivos: 8 },
      { sha: 'e567e14', msg: 'feat(nutricion): F3.3 — plantillas WA a Meta (auto-envío) + toggle de canal por paso', lineas: 450, archivos: 9 },
    ],
    archivos: [
      'lib/evolution-envio.ts — `esLeadCliente` (:17-22), `enviarBorrador` (:106-117), `descartarBorrador`',
      'lib/nutricion.ts — ramas oficial / no_oficial, guard anti-ban de 20 h',
      'lib/envio-flags.ts — los interruptores por workspace',
    ],
  },

  // ── 31 de julio: la tab nace ────────────────────────────────────────────────
  {
    fecha: '31 jul', hora: '11:09', chat: CH_AGENT, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'Terminar el setting automático y la nutrición',
    pedido: 'Tengo que terminar la funcionalidad de setting automatico y nutrición. Hay varias tareas al respecto en plan. Y tenemos cursos al respecto, etc...\nComienza a implementarlo.',
    puntos: [
      'Arranca la sesión más larga del área: **del 31/07 al 05/08**, y de la que salieron casi todas las decisiones de producto que siguen vigentes.',
      'Lo primero fue sacar el motor de la dependencia del funnel del dueño: enrolar por **etapa** en vez de por trigger hardcodeado, con el seed derivado de `funnel_config`. Un cliente con etapas propias tenía que poder nutrir sin que nadie escribiera su cohorte a mano.',
    ],
  },
  {
    fecha: '31 jul', hora: '11:45', chat: CH_AGENT, cuenta: 'claude1', actor: 'claude', tipo: 'correccion',
    titulo: 'Los 19 hallazgos, y la tab que nace esa misma tarde',
    puntos: [
      '⚠️ **El peor hallazgo no era un error: era un estado que no avanza.** «Lead sin teléfono» y «paso sin `template_wa`» se marcaban `fallo` sin `terminal`, y un fallo no terminal **no avanza `paso_actual` ni toca `proximo_envio_at`**. Como la ventana de trabajo es `limit(cupo*3)` ordenada por `proximo_envio_at` ASC, esas inscripciones conservan el timestamp más viejo y ocupan las primeras posiciones **en todas las corridas**: con 18 leads sin teléfono el motor no vuelve a mandar un solo mensaje real, y de paso inserta una fila de fallo por corrida, para siempre.',
      '**La regla que queda:** distinguí fallo *transitorio* (red, 5xx del proveedor) de condición *terminal* (opt-out, sin dato de contacto, sin plantilla). Todo estado de error de una cola tiene que avanzar el paso o correr el `proximo_envio_at`; si no hace ninguna de las dos, es un bloqueo de cabecera.',
      'Y el interruptor **por cliente** para nutrición y CRM automático: ningún cambio de comunicación es solo para el dueño.',
      'A la tarde nació la tab, y no se diseñó como un editor de flujos sino como **un WhatsApp**: cada secuencia es un «contacto» y al abrirla se reproduce la conversación. Eso fijó el criterio de que la simulación **no es un botón**, se reproduce sola al entrar. Sub-tabs WhatsApp / Email / Dashboard sobre el mismo dato.',
      '⚠️ Trampa que sigue viva: en la rama oficial `paso.cuerpo` **no es el mensaje**, es solo lo que Chatwoot pinta en el hilo. Lo que el lead recibe es la plantilla aprobada en Meta. Si el cuerpo del paso diverge del texto aprobado, **el inbox miente sobre lo que se mandó**. En la rama no oficial sí es el mensaje, y por eso ahí sí pasa por `aplicarVariables`.',
    ],
    commits: [
      { sha: 'f01bc90', msg: 'feat: interruptor por cliente para nutrición y CRM automático (tarea #5)', lineas: 344, archivos: 10 },
      { sha: 'b17c04b', msg: 'feat: nutrición agnóstica del funnel — enrolar por etapa + seed derivado', lineas: 156, archivos: 6 },
      { sha: '7839653', msg: 'feat: recordatorios de reunión en el motor + aprobar prende la secuencia', lineas: 70, archivos: 3 },
      { sha: 'af39816', msg: 'fix: 19 hallazgos de la revisión adversarial de setting/nutrición', lineas: 184, archivos: 8 },
      { sha: '59d5ee3', msg: 'feat(setting): base de jugadas — migración estrategia, parser, métricas y prueba en vivo', lineas: 298, archivos: 7 },
      { sha: '48fad0d', msg: 'feat(setting): tab /setting completa — jugadas, wizard de 7 pasos y prueba en vivo', lineas: 634, archivos: 8 },
      { sha: 'a75cfe0', msg: 'feat(setting): simulador interactivo con sub-tabs WhatsApp / Email / Dashboard', lineas: 457, archivos: 8 },
      { sha: '97daefa', msg: 'feat(setting): réplica del diseño SuperAdmin — jugadas como contactos + composer real + dashboard con gráficos', lineas: 636, archivos: 10 },
    ],
    archivos: [
      'lib/nutricion.ts — `procesarEnvios`, manejo de `fallo` vs `saltado` · lib/envio-flags.ts',
      'lib/setting-estrategia.ts — la estrategia de la secuencia (objetivo, cualificación, lead_magnet_id)',
      'lib/setting-simulador.ts — la prueba en vivo',
      'app/chat-agent/ — la tab (entonces /setting)',
    ],
  },
  {
    fecha: '1 ago', hora: '11:49', chat: CH_AGENT, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'Lo que salió de la reunión con Mauricio del 31/07',
    puntos: [
      'Cinco commits en cuarenta minutos, todos con el mismo origen: pasos de **nota de voz** con la biblioteca de audios del dueño, **inmediatez** (enrolar por evento en vez de esperar al cron), **modo asistido** (MaKo deja el borrador cuando el lead responde), cualificación con criterio real + descalificación, y las tres secuencias acordadas.',
      '⚠️ **Lo acordado no entra en el motor, y hay tres bloqueos concretos.** `PasoSecuencia` solo tiene `cuerpo` de texto —aunque `lib/evolution-envio.ts` ya sabe mandar notas de voz—; la secuencia guarda `lead_magnet_id` apuntando a un Entregable **que el motor no sabe entregar**; y el guard anti-ban `HS_MIN_ENTRE_MSGS = 20` mata la preparación de una reunión a 48 h, que exige varios toques cercanos. Hay que **separar el presupuesto anti-ban de la prospección fría del de una conversación ya abierta**.',
      'Y el enrolamiento sigue siendo por cron con `MAX_POR_CORRIDA = 6`, contra la regla explícita de que a quien llenó el formulario de Meta se le escriba **casi inmediato**.',
    ],
    commits: [
      { sha: '540691b', msg: 'feat(setting): pasos de NOTA DE VOZ + biblioteca de audios del dueño (reunión 31/07)', lineas: 475, archivos: 10 },
      { sha: '33336df', msg: 'feat(setting): inmediatez — enrolar por evento y cadencia de preparación', lineas: 103, archivos: 3 },
      { sha: '9e60c6a', msg: 'feat(setting): modo ASISTIDO — MaKo deja el borrador cuando el lead responde', lineas: 103, archivos: 7 },
      { sha: '498df0a', msg: 'feat(setting): cualificación con criterio real + descalificación + objetivo preparar', lineas: 243, archivos: 10 },
      { sha: 'b654456', msg: 'feat(setting): pasos condicionales + las 3 secuencias acordadas', lineas: 125, archivos: 4 },
    ],
    archivos: [
      'lib/nutricion.ts — `PasoSecuencia`, `HS_MIN_ENTRE_MSGS`, `MAX_POR_CORRIDA`',
      'lib/setting-estrategia.ts — objetivo, criterio de cualificación, `lead_magnet_id`',
      'lib/setting-audios.ts — la biblioteca del dueño (bucket `wa-media`, prefijo `${ws}/setting-audios/`)',
    ],
  },
  {
    fecha: '1 ago', hora: '15:12', chat: CH_AGENT, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'Toda tab tiene onboarding, y MaKo simula ser el cliente',
    pedido: 'Ya que sin excepción, todas las tabs van a requerir cierta configuración...\n\nHoy en día, ya tenemos un onboarding hecho, quiero que lo repliques en diseño y dinamica... Entonces todas las tabs tendrán como un estado de "Onboarding hecho o no". Eso también puede alimentar a MaKo cuando hay algo que optimizar y claramente no se hizo el onboarding en dicha tab...\n\nY para el caso este en específico, primero me imagino al onboarding configurando las cosas basicas necesarias, como el WhatsApp, el Email, haciendo pruebas de que todo llegue, pidiendo codigo de confirmación, etc...\nLuego, como vamos a armar todo con IA, me imagino una etapa de CONTEXTO... Y como regla siempre buscamos soluciones creativas nosotros, para que al usuario no le cueste cargar todo eso y su experiencia sea SIMPLE... Por ejemplo, podríamos pedirle que nos relate todas las secuencias de mensajes y eso generaría fricción, o podríamos pedirle EJEMPLOS ya sea conectandonos a su WhatsApp donde atiende clientes o que nos pase capturas de pantalla, etc...\nEntonces me imagino pidiendo contexto necesario y luego que MaKo sea el que propone las secuencias de mensajes... me imagino que por ejemplo, MaKo "SIMULE" ser cliente, y le haga preguntas... y ahí con el usuario y junto a la ayuda de MaKo ir respondiendo a todos esos escenarios, como si fuera un chat de WhataApp...\n\nBueno, ayudame a ordenar todas estas ideas, y sería bueno que también guardemos la metodologia en algun lugar, porque lo vamos a replicar en todas las tabs...',
    puntos: [
      'Este pedido creó **las tres etapas** que hoy tiene el onboarding de cualquier tab: **Conectar → Contexto → Ensayo**. Y la metodología se guardó, como pidió, en la skill `tab-onboarding`.',
      'La frase que más gobierna: «que al usuario no le cueste cargar todo eso». De ahí sale que el Contexto se saque de **sus conversaciones reales de WhatsApp** en vez de preguntárselas.',
      'En la misma tanda: «Sería bueno cambiar el nombre y la ruta de Setting por Chat Agent», y que si entrás a WhatsApp o Email sin nada configurado te pregunte si querés configurarlo todo o solo un canal. **Hay tabs que dependen de otras.**',
    ],
  },
  {
    fecha: '1 ago', hora: '16:05', chat: CH_AGENT, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'El onboarding de la tab, y Setting pasa a ser Chat Agent',
    puntos: [
      '**Lo aburrido va al FINAL.** Las credenciales y las APIs se piden al final del onboarding salvo que bloqueen el paso siguiente — nadie abandona un wizard en el paso donde le muestran para qué sirve, abandona en el que le piden un token.',
      'Regla de copy que salió de acá y vale para toda la app: **título corto, a lo sumo un subtítulo, el contexto abajo del todo y nunca interrumpiendo la acción**. Y el objetivo de cada paso tiene que estar escrito: «No puede ser simplemente "Leeré tus conversaciones" pero ¿PARA QUE?».',
      'El QR de WhatsApp se escanea **en el propio paso**: mandarlo a otra tab a mitad del onboarding es perderlo.',
      '⚠️ **El paso «Verificación» no verifica el canal que dice verificar.** El código se manda con `enviarCodigoVerificacion` → `enviarAlGrupoMaKo` → `instanciaVoz()`, que devuelve la línea de **voz de MaKo**, nunca `mako_ws<N>`. Un cliente con el WhatsApp completamente desvinculado completa igual el paso que se presenta como la prueba de que su canal entrega.',
    ],
    commits: [
      { sha: 'f8e1749', msg: 'feat(setting): el onboarding de la tab — 5 pasos con MaKo haciendo de CLIENTE', lineas: 540, archivos: 6 },
      { sha: '9296221', msg: 'fix+feat(onboarding de tab): no tapa el sidebar, y lo aburrido va al FINAL', lineas: 210, archivos: 4 },
      { sha: '81d862b', msg: 'feat(onboarding): elegir qué chats leer, objetivo claro, loaders y títulos cortos', lineas: 272, archivos: 6 },
      { sha: '1c9b35a', msg: 'Chat Agent, onboarding por canal, y el reset del cliente de prueba', lineas: 847, archivos: 34 },
      { sha: '0d9ace0', msg: 'Copy neutro, contexto en un bloque, y los dos bugs del diagnóstico', lineas: 435, archivos: 11 },
    ],
    archivos: [
      'app/chat-agent/OnboardingChatAgent.tsx — el wizard de la tab',
      'app/api/chat-agent/onboarding/ — contexto, conversaciones, prueba, resumen',
      'app/api/chat-agent/onboarding/prueba/route.ts:45-51 — el paso que verifica la línea equivocada',
      'lib/tab-onboarding-state.ts — el estado por tab, que alimenta a MaKo',
    ],
  },
  {
    fecha: '2 ago', hora: '17:57', chat: CH_AGENT, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: 'Los nueve puntos: nunca más «Jugada», y no gastes créditos en el ensayo',
    pedido: '1. NO gastes creditos de CLAUDE en el ensayo, saldrá carísimo, no tiene sentido...\n2. Simula MUCHO mejor la interfaz del chat de WhatsApp, para ello COPIA y replica la que ya tenemos... Porque hay cosas que faltan y otras que funcionan mal, por ejemplo cuando envio un mensaje, en la barra para escribir se queda el mensaje que ya envié escrito...\n3. En el paso de "Las jugadas" debería justamente mostrarme el RESUMEN de las jugadas que armó… Puedes copiar lo que hicimos con el resumen del archivero, que son bloques desplegables.\n4. Luego de las jugadas quedaban muchos pasos supuestamente en el form, y aún así se me salió y me dirigió a la vista de "WhatsApp"… en ese caso NO debería dejarme avanzar directo a esa vista, sino, terminar todo el onboarding...\n5. Elimina TODAS las secuencias que existen... Cuando entro a la vista fuera del onboarding, me debe salir únicamente las 3 secuencias que acabamos de armar con los audios… Lo que si estaría bueno es una advertencia que falta armar secuencias o algo así, porque MaKo sabe todos los pasos de tu funnel, todas las "Nutriciones" que hay, y sabe que no existe una secuencia de mensajes armada cuando existe ese status de nutrición…\n6. Tal cual como funciona en Super Admin, la "simulación" no debe existir como botón, sino que debe reproducirse automáticamente al entrar al "contacto" que son las secuencias.\n7. NO debe existir la tab de "Audios", para eso justamente ya tenemos el botón de "Nueva jugada" que dentro debería poder cargarle audios... Lo que si te pido es que no lo llames nunca más en ningún lado "Jugada" es "Nueva Secuencia de Mensajes".\n8. Cuando le doy a "Nueva Sencuencia de Mensajes" debe ser algo MUY similar al onboarding… el mismo tamaño, la barra negra al costado, todo igual en diseño.\n9. El primer paso está bien, pero el segundo MaKo debería dar un CONTEXTO o una explicación de la situación del lead…',
    puntos: [
      'El punto 7 es una regla, no una corrección: **«Jugada» no se usa nunca más en ningún lado**. Se renombró en 30 archivos.',
      'El punto 5 fijó otra: **no se siembran secuencias de ejemplo**. Al entrar solo se ven las que armó el usuario; lo que MaKo hace en cambio es **avisar el hueco** — sabe los estados de nutrición del funnel y sabe cuál no tiene secuencia asociada.',
      'El punto 1 es de costo, y cambió el diseño del ensayo: el lead simulado no puede salir caro por mensaje.',
      'El punto 7 tiene una lectura de producto: la sub-tab «Audios» existía porque el audio se pensó como un recurso; él lo quiere **dentro del paso donde se usa**. Grabás mientras armás el mensaje, no antes en otro lado.',
    ],
  },
  {
    fecha: '2 ago', hora: '18:05', chat: CH_AGENT, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'La remontada del 2 de agosto: diez commits en tres horas',
    puntos: [
      'El renombre completo, el wizard rehecho sobre el shell del onboarding, el audio grabándose dentro de cada mensaje, el ensayo convertido en **9 escenarios con título, uno por slide**, y variantes anti-repetición para que dos leads simulados no digan lo mismo.',
      '**El hand-off:** si el lead se sale del guion, MaKo **se calla** y avisa. No improvisa. Es la contracara de la regla de que a un lead caliente no le escribe un bot.',
      '⚠️ **«Los audios no sonaban» y el archivo estaba bien.** Diagnóstico obvio equivocado: el `.mp3` estaba entero en el bucket y la URL firmada resolvía — faltaba **cargarlo** en el elemento. Costó un commit entero mirar el lugar equivocado.',
      'Se dejó de sembrar secuencias de muestra y se agregó el aviso de hueco del funnel.',
    ],
    commits: [
      { sha: 'fa44915', msg: 'feat(chat-agent): el analisis de voz filtra la venta y pregunta lo que no dedujo', lineas: 796, archivos: 4 },
      { sha: '3f42095', msg: 'feat(chat-agent): los 3 audios se graban en el propio paso, con guion en tu voz', lineas: 556, archivos: 6 },
      { sha: '623698f', msg: 'feat(chat-agent): el ensayo pasa a ser 9 escenarios con titulo, uno por slide', lineas: 414, archivos: 3 },
      { sha: '5804e12', msg: 'refactor(chat-agent): "Jugada" pasa a llamarse "Secuencia de Mensajes" en todos lados', lineas: 236, archivos: 30 },
      { sha: 'c7c7271', msg: 'feat(chat-agent): se deja de sembrar secuencias; lo que falta se avisa', lineas: 237, archivos: 10 },
      { sha: '4a302d6', msg: 'feat(chat-agent): el wizard de secuencia se rehace sobre el shell del onboarding', lineas: 678, archivos: 9 },
      { sha: 'f723a86', msg: 'feat(chat-agent): protocolo de hand-off — si el lead se sale del guion, MaKo se calla', lineas: 451, archivos: 11 },
      { sha: '27495ca', msg: 'feat(chat-agent): el audio se graba DENTRO de cada mensaje; fuera la sub-tab Audios', lineas: 195, archivos: 6 },
      { sha: 'b7b9487', msg: 'fix(chat-agent): los audios del ensayo no sonaban — el archivo estaba bien, faltaba cargarlo', lineas: 29, archivos: 2 },
      { sha: '862ab6c', msg: 'fix(chat-agent): el ensayo GUARDA cada caso; un solo boton de avance', lineas: 177, archivos: 4 },
    ],
    archivos: [
      'app/chat-agent/ — el wizard de secuencia, el ensayo, el composer',
      'lib/setting-simulador.ts — el lead simulado',
      'lib/setting-secuencias.ts — las secuencias que arma el onboarding',
    ],
  },
  {
    fecha: '2 ago', hora: '19:05', chat: CH_AGENT, cuenta: 'claude1', actor: 'claude', tipo: 'cosecha',
    titulo: 'Lo que encontró la auditoría del onboarding, y quedó escrito',
    puntos: [
      '⚠️ **Los `[tu link …]` NUNCA se reemplazan, y tres comentarios del repo juran que sí.** Al lead le llega literal «te dejo el video de preparación: [tu link del video]». `aplicarVariables` solo sustituye `{{key}}` contra las 4 claves de `VARIABLES_LEAD`; **no hay una sola línea en el repo que toque los corchetes**. Peor: `RX_RELLENO` los excluye A PROPÓSITO del detector de «copy sin terminar», y el prompt del generador le ordena al modelo dejarlos tal cual porque «el sistema los reemplaza». **El diagnóstico obvio —el modelo escribió mal— es el equivocado: el modelo obedeció una promesa que el sistema nunca cumplió.**',
      '⚠️ **`requiere: \'sin_respuesta\'` está declarado, sembrado y pintado en la UI — y el motor no lo evalúa nunca.** El loop de `procesarEnvios` solo tiene ramas para `\'respondio\'`, `\'ya_contactado\'` y `\'primer_contacto\'`. La condición **no falla: no existe**, y el compilador no dice nada. Regla: un valor nuevo de `requiere` toca TRES lugares (tipo + normalizador + rama del loop).',
      '⚠️ **El audio copiado del dueño se degrada a un WhatsApp VACÍO.** `remapearJson` cierra con `?? null`, y el motor decide con `Number(paso.audio_id) > 0`: `Number(null) === 0`, así que nunca entra a la rama de audio. Cae a texto y sale con `paso.cuerpo`, que en las secuencias del Chat Agent es el PIE — y en post-agenda es literalmente `\'\'`. El comentario que dice que «el motor falla y reintenta» es falso.',
      'Todo esto vive en `docs/hallazgos-comunicacion.md`, sección **Nutrición y secuencias**. La regla de la casa: lo que aprende un subagente no vuelve solo — si no se escribe en el repo, se pierde.',
    ],
    commits: [{ sha: '39fa6af', msg: 'fix(nutricion): dos bugs de produccion que encontro la auditoria', lineas: 24, archivos: 2 }],
    archivos: [
      'docs/hallazgos-comunicacion.md — donde quedó cosechado',
      'lib/nutricion.ts:539-543 (`RX_RELLENO`) · :59 y :944-965 (`requiere`) · lib/template-vars.ts:41',
      'lib/datos-mau.ts:489 — el `?? null` del remapeo de audios',
    ],
  },

  // ── 5 de agosto: el objetivo y el desenlace ─────────────────────────────────
  {
    fecha: '5 ago', hora: '08:15', chat: CH_AGENT, cuenta: 'claude1', actor: 'martin', tipo: 'prompt',
    titulo: '«MaKo pareciera un eterno objetor»: la secuencia necesita un objetivo',
    pedido: 'Desconozco si hay una tarea al respecto... Pero algo importante es que las SECUENCIAS debería saber cuando finalizar, hacer hand-off o comenzar otra secuencia, y para eso es importante definir el OBJETIVO de esa secuencia. Es decir, si está corriendo la secuencia de "Reactivación", el único objetivo es que el lead responda algo, lo que sea. Y cuando eso se cumpla, ya está la secuencia debe finalizar, y de última comenzar otra secuencia de "Cualificación" por ejemplo... Y puede ser positivo o negativo el resultado de ese objetivo… Y claro, en el paso entre secuencia debe tener siempre en cuenta la hora y el tiempo del último mensaje, porque si se le pasa la mano a otra secuencia y de pronto le envía inmediatamente el mensaje de seguimiento no tiene sentido... Es decir, hay que configurar bien tanto lo saliente, en ese caso ¿Cuándo se lo considera que dejó de responder? Porque no es lo mismo que no responda en 10 minuto a que no responda en 24 hs... Y lo entrante: Antes de enviar algo ¿Qué fue lo último que se envió y cuándo…? Y esta lógica se tiene que aplicar en las pruebas de las secuencias con MaKo, porque lo estuve probando y MaKo pareciera un eterno objetor, no importa que le diga si está configurado como para objetar lo seguirá haciendo... Lo entiendo 1, 2 veces, incluso 3 como mucho rebatir la objeción, pero que luego siga insistiendo con lo mismo no es el comportamiento normal de un lead… Y cuando se finalice un objetivo no me debería dejar enviar más mensajes, debe saltar un mensaje de "Completado" o "Secuencia guardada" y mejor si le da algún tipo de "felicitación" al usuario, para que sea dopaminico.',
    puntos: [
      'Este es el pedido que le dio arquitectura al área: **una secuencia termina por OBJETIVO** —cumplido o fallado— y hace hand-off a la siguiente teniendo en cuenta **cuándo fue el último mensaje**.',
      'El síntoma que lo destapó era del ensayo, no del motor: sin objetivo, el lead simulado no tiene condición de corte y objeta para siempre. **El mismo defecto en los dos lados**, y por eso se arregló en el modelo de datos y no en el prompt.',
      'La felicitación al cerrar no es adorno: «para que sea dopamínico». Un wizard largo necesita marcar dónde terminó cada tramo.',
      'Y el mensaje de «Secuencia guardada» va **en la misma tab**, no en la siguiente. Cerrar algo se confirma donde lo hiciste.',
    ],
  },
  {
    fecha: '5 ago', hora: '13:42', chat: CH_AGENT, cuenta: 'claude1', actor: 'claude', tipo: 'implementacion',
    titulo: 'El desenlace se evalúa de verdad, y se mide en horas',
    puntos: [
      'La secuencia pasó a tener **desenlace evaluado**: se cierra cuando se cumple el objetivo (positivo o negativo) y encadena a la siguiente. El «dejó de responder» dejó de ser un booleano y se mide en **horas**, porque no es lo mismo no responder en 10 minutos que en 24.',
      'El ensayo concluye: el caso se cierra y se celebra **en SU slide**, no en la siguiente. Y MaKo conoce al avatar antes de improvisar un lead — sin eso planteaba casos fuera del negocio (un lead que factura 3.000 USD al mes cuando el avatar de Mauricio no es ese) y parecían al azar, porque lo eran.',
      '⚠️ **Trampa de contrato encontrada acá:** `estadoEnVivo()` devuelve `{estado:\'error\'}` y la ruta lo envuelve en `Response.json({ ok:true, ...s })`. El onboarding chequea solo `j.ok && j.estado`, no matchea ninguna rama y cae al último else — le ofrece «Generar código QR» a un número ya vinculado, **y re-escanear tumba la sesión viva**. Un `ok:true` con un `estado:\'error\'` adentro es una mentira de contrato.',
      'Lo que queda para el go-live está en el Roadmap: los flags siguen apagados y hay que decidir la semántica del paso de un canal apagado **antes** de que existan inscripciones, porque `comprometerInscripciones` dedupea por (lead, secuencia) con un unique y el lead no se puede reinscribir nunca — el paso queda QUEMADO.',
    ],
    commits: [
      { sha: '2ff6bf6', msg: 'feat(nutricion): el desenlace se evalua de verdad — una secuencia sabe cuando termino', lineas: 195, archivos: 4 },
      { sha: 'ef08178', msg: 'fix(chat-agent): el ensayo concluye, no deriva y conoce al avatar', lineas: 673, archivos: 7 },
      { sha: '773d290', msg: 'fix(chat-agent): el analisis de "Tu forma de escribir" ya no se cuelga (#373)', lineas: 37, archivos: 1 },
      { sha: '51ee044', msg: 'fix(chat-agent): el paso queda sin salida y los audios se piden de mas (#375, #376)', lineas: 104, archivos: 6 },
      { sha: '4fda530', msg: 'feat(chat-agent): confirmacion de agenda, publico, avatar en los guiones y duracion del audio', lineas: 265, archivos: 11 },
      { sha: 'b96e9e4', msg: 'fix(chat-agent): el caso se cierra y se celebra en SU slide, no en la siguiente', lineas: 34, archivos: 1 },
      { sha: '84ece3b', msg: 'feat(chat-agent): el desenlace de una secuencia encadena a otra, y se mide en HORAS', lineas: 108, archivos: 5 },
      { sha: 'eb3b79d', msg: 'feat(chat-agent): la secuencia encadena a la siguiente, y la prueba deja de objetar para siempre', lineas: 318, archivos: 8 },
    ],
    archivos: [
      'lib/nutricion.ts — el desenlace y el encadenado',
      'lib/setting-estrategia.ts — objetivo de la secuencia y secuencia siguiente',
      'lib/setting-simulador.ts — el lead simulado con condición de corte',
      'app/chat-agent/OnboardingChatAgent.tsx:407-418 — la guarda que se olvidó la mitad de `estado !== \'error\'`',
    ],
  },

  // Cosecha retroactiva (17 ago): tandas que se trabajaron y no habian dejado
  // hito. Salieron de cruzar el git log del area contra este mismo archivo.
  {
    fecha: "6 ago", hora: "18:33", chat: "Conocimientos - CURSOS", cuenta: "claude2",
    actor: "claude", tipo: "implementacion",
    titulo: "Tres nombres en un día, y la `key` que no se puede tocar",
    puntos: [
      "El módulo se renombró tres veces en 24 h: /chat-agent → /chat-bot → /chatbot, y la familia pasó de «Create» a «Sales Machine», con el Chatbot en el bloque «conversar» del embudo (capturar / conversar / cerrar). Las tres rutas viejas quedan redirigiendo. La `key` interna sigue siendo 'setting' y las rutas de /api/chat-agent quedaron como estaban.",
      "La decisión es qué NO se renombra: la `key` 'setting' está escrita en la base (capas contratadas y estado del onboarding por tab), así que cambiarla apagaría la tab en los clientes que ya la tienen — el nombre visible es cosmético, la clave es un dato. Y los tres alias quedan vivos porque el path viejo ya viajó afuera: está en tareas del board y en mensajes que MaKo ya mandó. Eso se cobró después: el 16/08 los tres redirects de esta tab (/chat-agent, /chat-bot, /setting) estaban entre los 26 que perdían el `?ws=`, o sea que abrir un link viejo de un cliente te sacaba del cliente. Un alias no es una línea muerta: es una navegación, y tiene que preservar la pestaña.",
    ],
    commits: [
      { sha: "f00f9cf2", msg: "Rediseño · la barra deja de cerrarse sola, y la sección deja de ser una fila", lineas: 107, archivos: 19 },
      { sha: "a56135f0", msg: "Rediseño · Sales Machine y los 14 íconos del set", lineas: 176, archivos: 13 },
      { sha: "0c963246", msg: "Horarios: las 24 h completas y UN solo formato", lineas: 40, archivos: 14 },
      { sha: "897ce26e", msg: "Un redirect es navegación: los 26 que perdían el ?ws= de la pestaña", lineas: 126, archivos: 26 },
    ],
  },
  {
    fecha: "9 ago", hora: "20:40", chat: "—", cuenta: "claude2",
    actor: "claude", tipo: "implementacion",
    titulo: "Linkear sin ancla es dejar al usuario en la recepción",
    puntos: [
      "Se le pusieron anclas de deep-link a /chatbot: ?stab=<whatsapp|email|dashboard> y ?sec=<id|clave>, que abre el wizard en esa secuencia. Antes la carpeta /chatbot tenía CERO useSearchParams, así que todo link de MaKo aterrizaba en la lista completa. El vocabulario (?stab=, ?tab=, el id como parámetro) se copió del que ya usaban /whatsapp y /crm.",
      "Es el prerrequisito de la regla «si el contenido se edita en otra pantalla, el modal no lo dibuja: lo nombra y linkea». Sin ancla, esa regla degrada a mandar al usuario a buscar cuál de todas era. Y quedaron dos decisiones que valen para las anclas que faltan: (1) se acepta el id Y la clave, porque MaKo arma el link desde mako-capacidades.ts, donde tiene el nombre de la cosa y casi nunca el id numérico — un ancla que solo entiende ids obliga a consultar antes de poder escribir el link; (2) un valor que no existe no abre NADA: se valida contra la lista real y se limpia el parámetro, porque abrir el wizard con un id de otro workspace mostraría una secuencia vacía en vez de decir que no está. Verificado contra el build de producción (next dev no hidrata en este proyecto).",
    ],
    commits: [
      { sha: "ba4da613", msg: "Tres anclas: el link de MaKo aterriza en la cosa, no en la puerta", lineas: 124, archivos: 4 },
    ],
  },
  {
    fecha: "10 ago", hora: "17:02", chat: "Chatbot", cuenta: "claude2",
    actor: "claude", tipo: "implementacion",
    titulo: "El chatbot leía cómo TERMINA el funnel, y lo que separa a un cliente de otro es cómo ENTRA",
    puntos: [
      "Corrida de 13 subagentes (`chatbot-funnel-leila`) disparada por un caso real: Leila (ws11) prospecta en frío por WhatsApp y cierra en un taller presencial, y el sistema le pidió grabar un audio que arranca «vi que dejaste tus datos en el anuncio». Sus 27 leads tienen meta_lead_id = 0 y origen_lead NULL. Se agregó el eje `funnel_config.data.entradas` (5 valores, [] = NO declarado) + evento + el canal `presencial`; audiosDe/escenariosDe pasaron a no tener default; cuatro audios y cuatro escenarios nuevos, con los tres de ws1 congelados por assert literal.",
      "Tres cosas que se pierden si no se escriben. (1) El diagnóstico obvio era el equivocado: «MaKo no sabe el funnel del cliente» era falso — resumenFunnel() ya lo inyectaba en cuatro features. El funnel entraba como dato descriptivo arriba y el catálogo de Mauricio como imperativo quince líneas más abajo, y el imperativo gana siempre. Por eso el consumo pasó a ser determinista (guionDe) más una prohibición explícita con regex que la verifica y reintento. (2) Un funnel modelado solo por sus etapas describe el RECORRIDO, no los ACTIVOS (landing, video, formulario, agenda automática): los activos se declaran, no se infieren de la forma del pipeline. (3) Todo el chatbot fallaba ABIERTO hacia el funnel del dueño — cuatro defaults optimistas (hayReunion=true en dos lugares, getFunnel cayendo a DEFAULT_PIPELINE tanto si no hay fila como si hubo ERROR), así que un cliente sin funnel declarado o con Supabase caído recibía el embudo de Mauricio sin enterarse. Y queda escrito el ORDEN: resetear al cliente antes de arreglar el catálogo no sirve, regraba el mismo audio equivocado. Lo que quedó a mitad (sin premarcado desde evidencia, sin backfill, secuencias-audios todavía colgando de instant_form_sin_agenda, falta el objetivo 'asistir' en setting-estrategia) está en docs/hallazgos-comunicacion.md § «El Chatbot (ex Setting / Chat Agent) y el funnel del cliente».",
    ],
    commits: [
      { sha: "9df4de61", msg: "funnel: el eje que faltaba — cómo ENTRA un lead, y los audios que salen de ahí", lineas: 1752, archivos: 23 },
    ],
  },
  {
    fecha: "10 ago", hora: "17:45", chat: "Chatbot", cuenta: "claude2",
    actor: "claude", tipo: "implementacion",
    titulo: "El onboarding se dio por terminado sin un solo audio grabado",
    puntos: [
      "Pasó en vivo, con una clienta delante: la tab quedó `done` marcando `ensayo` y `aprobar` con diez segundos de diferencia (20:37:38 → 20:37:48) y sin ningún audio. Con la tab en `done`, la pantalla muestra el dashboard —vacío, sin secuencias— en vez del onboarding. Se arreglaron las dos causas y la condición de orden salió a lib/onboarding-orden.ts, sin server-only, con 7 tests.",
      "Dos reglas que gobiernan cualquier wizard nuevo. (1) `marcarPasoTab` aceptaba cualquier clave del def, así que marcar el ÚLTIMO paso cerraba el recorrido entero; el guard va en el SERVER, porque la UI ya deshabilitaba «Siguiente» y aun así se llegó — esconder el botón no protege nada. (2) ChatAgentApp mostraba la tab normal ante cualquier respuesta que no fuera ok, y el catch hacía lo mismo: si no se pudo SABER si el onboarding está completo, mostrar el dashboard es afirmarlo. Un 403 sí es legítimo (el setter no es admin y ve la tab); el resto, no. Es el mismo patrón que en la misma corrida rompió los canales: un `null` que se pinta como afirmación es una mentira en pantalla, así que el error vive en su propio estado y no colapsado en el null del dato.",
    ],
    commits: [
      { sha: "073d606b", msg: "onboarding: no se puede saltear un paso, y sin saber no se muestra el dashboard", lineas: 136, archivos: 4 },
    ],
  },
  {
    fecha: "4 oct", hora: "11:40", chat: "Chatbot", cuenta: "claude2",
    actor: "martin", tipo: "prompt",
    titulo: "Extraer el feedback del chatbot de la llamada con Leila del 01/10",
    pedido: "Revisa la ultima llamada que tuvimos con Leila, del 1 de octubre, ya otros chats hicieron la extracción, por si te puedes aprovechar... De allí salió feedback del chatbot, de como encararlo, extrae todo y trabajemos sobre eso",
    puntos: [
      "La extracción anterior (docs/llamada-leila-01oct.md) contestaba otra pregunta —el orden, las fechas y la poda— y del Chatbot sólo traía dos líneas. El pedido es el hilo entero.",
    ],
  },
  {
    fecha: "4 oct", hora: "11:40", chat: "Chatbot", cuenta: "claude2",
    actor: "claude", tipo: "investigacion",
    titulo: "El motor que la llamada pidió ya existe, y las cuatro acciones que tocan al lead mueren al confirmarse",
    puntos: [
      "5 lectores sobre el transcript completo (1.001 intervenciones) con panel de verificación, más el estado de producción medido contra la base. El entregable es docs/chatbot-leila-01oct.md. Lo que la llamada dejó decidido y el doc anterior no tenía: el encargo es «un soporte para la MASA, no para esos nueve» (01:37:00) y es de MARTÍN, no de Leila; el P1 lo empuja MAURICIO (00:26:25, 00:40:38, 00:51:00); y el problema central —atar una automatización libre a una persona— se resolvió en la llamada en 40 segundos: etapa del CRM (lo propuso Leila en dos palabras) más tags.",
      "El hallazgo gordo es que el motor pedido está entero y roto en el último metro: los cuatro `flujo_*` no están en el registro de la API ni en TIPOS_HEREDADOS, así que la pendiente muere con «operación desconocida», y un paso `esperar` corta porque falta el cron drenador. Y tres cosas que la llamada trató como nuevas ya están pagas: las etiquetas de WhatsApp (el backend corre desde el 28/08 y `evolution_stage_labels` es el puente, vacío, con las 23 etiquetas reales de Leila ya sincronizadas en `evolution_labels`), la miniatura del link (una bandera del payload) y que MaKo arme la secuencia desde un audio (la transcripción y las cuatro acciones de la API ya están).",
      "Lo que midió la base y cambia el encare: `nutricion_envios` tiene 12 filas en toda la tabla, las 12 en `fallo`, las 12 del ws1 — el motor NUNCA entregó un mensaje, con 65 secuencias configuradas. Un pedido de producto sobre eso se cotiza como feature y es un arreglo. Y la trampa de extracción que quedó como regla en AGENTS.md: la mitad de lo que dice quien mira la pantalla compartida es el texto de la app en voz alta — «la cuota 2 de Vertice venció hace 3 días» es el `ejemplo:` de lib/avisos-catalogo.ts:697, escrito dos días antes, no el caso de la clienta.",
    ],
  },
  {
    fecha: "5 oct", hora: "02:00", chat: "Chatbot", cuenta: "claude2",
    actor: "martin", tipo: "prompt",
    titulo: "Diez cosas del editor de mensajes, y ManyChat a fondo",
    pedido: "Las plantillas deberían poder crearse desde 0, nada \"hardcodeado\" · La barra de edición del mensaje afuera del cuadro de texto · Para el desplegable de acciones de MaKo, copia el estilo del desplegable del filtro del plan, que se abren secciones dentro del desplegable · Si no está disponible no lo muestres directamente, no que esté en gris, eso confunde · Dentro del mensaje de WhatsApp: mensaje fijo o IA conversacional, investiga cómo lo hace ManyChat · Olvidate de WhatsApp oficial, no entiendo de donde lo sigues sacando, si todo esto es para la no oficial · Revisa que hay acciones que están tardando más de la cuenta, cargar la vista tipo pizarra es lento y crear una nueva tarjeta se tarda bastante · El fondo de la pizarra con cuadrícula · Falta audio, archivo, imagen, link: replica el editor que ya existe · Llevar todo a /chatbot conservando las secuencias de Mauricio y sus audios grabados",
    puntos: [
      "Y aparte: «Quiero que investigues a fondo la documentación y todo lo que encuentres de Manychat, para que lo repliquemos y utilicemos a nuestro favor… qué otras cosas que no estamos teniendo en cuenta que manychat ya tiene».",
    ],
  },
  {
    fecha: "5 oct", hora: "02:21", chat: "Chatbot", cuenta: "claude2",
    actor: "claude", tipo: "investigacion",
    titulo: "ManyChat a fondo: 130 afirmaciones contrastadas, 55 caídas",
    puntos: [
      "25 agentes sobre 7 ángulos (modelo de datos, editor, IA, disparadores, WhatsApp, buenas prácticas y el cruce contra nuestro código). De 151 hallazgos salieron 130 afirmaciones verificables que se contrastaron una por una contra la fuente: 75 sostenidas, 55 caídas. Cuatro cosas del primer barrido no se usaron, y la más instructiva es que la «prueba» de un renombre por el slug de una URL no prueba nada: Zendesk redirige cualquier slug al canónico.",
      "Lo que decide trabajo: para WhatsApp ManyChat NO es el molde, es el techo de la API oficial de Meta (su doc le prohíbe video, audio, archivos, galerías y quick replies), y nosotros estamos ARRIBA de ese techo porque el canal de empresa va por Evolution, que ya manda las cuatro cosas. Y lo que publican es el formato del MENSAJE, no el grafo del flujo: su API expone el objeto Flow con TRES campos.",
      "El molde que queda para los ítems 5 y 9: la IA es un CAMPO del nodo de mensaje y no un tipo de nodo (un nodo nuevo son CINCO puertas, y la quinta ya costó las variantes borradas en silencio), el cuerpo escrito es obligatorio también en modo IA porque es el fallback, los adjuntos van por REFERENCIA a una biblioteca como el audio, y hay una condición de entrada que no se ve: la columna nutricion_envios.texto_enviado, porque hoy el log guarda el asunto y el error pero NO el cuerpo — un nodo IA sin eso le habla a los leads del dueño y no le deja auditarlo.",
      "Las 13 cosas que ellos tienen y nosotros no, con la más barata primero: las métricas por PASO son un group-by sobre una columna que ya existe. Y dos bugs NUESTROS que salieron del cruce: el lienzo resolvía {{negocio}} y el motor no (al lead le llegaban las llaves puestas) y la ventana de envío está hardcodeada 9-21 en hora de México para todo inquilino. Todo en docs/hallazgos-comunicacion.md.",
    ],
    commits: [
      { sha: "6e4f5c0d", msg: "ManyChat a fondo: el molde del nodo, y el lienzo resolvia un token que el motor no", lineas: 357, archivos: 6 },
    ],
  },
  {
    fecha: "5 oct", hora: "02:30", chat: "Chatbot", cuenta: "claude2",
    actor: "martin", tipo: "prompt",
    titulo: "Disparar una secuencia cuando un lead cae en una etapa de un producto",
    pedido: "Tienes que poner un CRON que se active mediante que un lead caiga en X etapa de X producto. Recuerda que ahora tenemos varios productos en el CRM, y dentro de cada producto se pueden configurar etapas, entonces esto debería leer eso y que el usuario pueda elegir que si cae en dicha etapa, se dispare esa secuencia.",
    puntos: [
      "Y la segunda mitad, que se repartió al chat de Customer Success: que lo mismo valga para un CLIENTE que llega a una etapa de la ENTREGA del servicio (onboarding, hito 1, hito 2…), con el kanban en /customer-success copiando del CRM la vista de tarjetas, la de tabla, la selección de productos, los filtros y la búsqueda.",
    ],
  },
  {
    fecha: "5 oct", hora: "03:10", chat: "Chatbot", cuenta: "claude2",
    actor: "claude", tipo: "implementacion",
    titulo: "El disparador por etapa existía en la base y no tenía pantalla ni evento",
    puntos: [
      "Las dos puntas que faltaban. (1) El EVENTO: lo descubría sólo el barrido horario del cron, así que mover una tarjeta y que salga el mensaje estaban separados por hasta una hora; ahora lo dispara setBoardStageOverride, que es el choke point por donde pasan la ficha, el arrastre del kanban y la confirmación de MaKo. (2) La PANTALLA: el perfil de la secuencia ofrece las etapas reales de cada producto (un producto es un embudo desde la mig 0171), sin las de salida, y «Todos los productos» es una opción con ese nombre y no la ausencia del dato.",
      "El filtro fino es lo que hace seguro el camino: enrolarPorEvento enrola en TODAS las secuencias de su trigger —correcto para lead_nuevo— y acá sería mandarle al que cayó en «Agenda» también el mensaje de «Facturando» y el del producto de al lado. Lo decide secuenciasDeEtapa, puro y con test, y su condición más importante es la del vacío: un evento sin etapa devuelve [], nunca «entonces todas».",
      "LO QUE CAZÓ EL NAVEGADOR Y EL CÓDIGO NO: no toda secuencia se dispara por una etapa. De los 17 disparadores, 16 consultan columnas del funnel, así que para ésos la columna `etapa` existe pero no es lo que los dispara — y la primera versión del control mostraba «Se dispara al caer en X» para todos, de modo que guardar ahí convertía un disparador de formulario en uno de etapa sin que nadie lo pidiera. En el ws1 las tres secuencias son de ese tipo. El control ahora se OFRECE: si ya se dispara por etapa se edita, y si no, se dice por qué se dispara de verdad.",
      "Verificado en el navegador 10 de 10 contra producción, con respaldo propio (scripts/respaldo-disparadores.ts) y comprobando la FILA después de guardar. Lo que queda sin verificar a propósito: el circuito completo, porque mover un lead real le manda un WhatsApp a una persona — se prueba con un lead de prueba en el ws3.",
    ],
    commits: [
      { sha: "1dc96035", msg: "El disparador de una secuencia: «al caer en ESTA etapa de ESTE producto», elegible", lineas: 467, archivos: 8 },
    ],
  },
  {
    fecha: "5 oct", hora: "04:00", chat: "Chatbot", cuenta: "claude2",
    actor: "martin", tipo: "prompt",
    titulo: "Seis cosas de /chatbot: el nombre, las pestañas y la grilla",
    pedido: "Elimina lo de \"Chat agent\" de todos lados, es Chatbot... Elimina las pestañas, ya no hay \"Email\" si todo se crea en un mismo lugar... Ya no hay plantillas si todo es lo mismo... Y la pestaña de dashboard ponlo en una nueva ruta dentro de \"Analysts\" de la sidebar... Elimina el botón grande de \"Nueva secuencia\", si ya tenemos otro para eso... Elimina lo de \"Archivar todo...\", elimina \"Tus secuencias: pruébalas como el lead, chatea con MaKo-setter y mira cómo rinden.\"... Haz que \"Hay 6 etapas sin secuencia de mensajes: \" sea mucho más sutil... Recuerda que por DEFAULT abro la tab y debe salir la grilla para editar las secuencias, y al darle a PROBAR recién la vista del chat... No pongas a la grilla chiquita en el medio en un recuadro, haz que ocupe TODA la tab.",

    puntos: [
      "Llegó con cuatro capturas: la tab con sus cuatro pestañas, la pantalla de carga que decía «Abriendo tu Chat Agent…», el menú de Analysts abierto y el chat ocupando el lugar del trabajo.",
    ],
  },
  {
    fecha: "5 oct", hora: "04:40", chat: "Chatbot", cuenta: "claude2",
    actor: "claude", tipo: "implementacion",
    titulo: "La tab abre en la grilla, el chat es consecuencia de PROBAR, y el dashboard se fue a Chat Analyst",
    puntos: [
      "Las cuatro sub-tabs partían UNA cosa en cuatro pantallas: Email y WhatsApp son dos canales de la MISMA secuencia y se arman en el mismo lienzo, Plantillas son las de Meta (canal oficial, que ya no gobierna este editor) y el Dashboard contesta otra pregunta. Quedó en /chat-analyst, que estaba en la sidebar con cartel de PRONTO — y eso es una decisión que se revierte en una línea: ese nombre estaba pensado para analizar CONVERSACIONES.",
      "La grilla ocupaba 1180 de 1460 px y centrada, y la causa no era el layout: `.cl-grid` viene de la cartera de clientes y trae `max-width: var(--cartera-max)` + `margin: 0 auto`. Se apaga con el token, que es el escape que el propio componente documenta.",
      "El renombre tocó 39 archivos y NO las bitácoras de /admin: un registro fechado dice lo que se dijo ESE día. Los nombres de archivo quedan (ChatAgentApp.tsx): renombrarlos con otras dos sesiones sobre el mismo clon es pisarle imports a alguien, y el nombre de un archivo no se dibuja.",
    ],
    commits: [
      { sha: "44d9fee6", msg: "/chatbot: se llama Chatbot, abre en la grilla, y el chat sale de PROBAR", lineas: 329, archivos: 40 },
    ],
  },
  {
    fecha: "5 oct", hora: "05:10", chat: "Chatbot", cuenta: "claude2",
    actor: "claude", tipo: "implementacion",
    titulo: "Las secuencias de la ENTREGA, con la sesión de Customer Success del otro lado",
    puntos: [
      "Ellos el choke point y el catálogo de etapas (mig 0188), yo el motor y el selector. Las dos cosas que lo salvaron las midieron ELLOS antes de que existiera mi código, y las dos se veían como «reusá lo que ya hay»: (1) reusar el evento de etapa de venta funciona HOY porque el choque entre los dos defaults es cero, y las dos listas las edita el cliente — el día que alguien llame «facturando» a una etapa de entrega, mover un cliente en el kanban dispara una secuencia de VENTA; (2) un productoId no es un funnelId, y del producto al embudo hay dos saltos.",
      "El «Deshacer» del toast revierte llamando al MISMO choke point con la etapa anterior, así que dispara un segundo evento hacia atrás. No se resolvió detectándolo —un flag de UI en el modelo es peor— sino con la regla que ya estaba escrita: salir de una etapa CIERRA lo que esa etapa tenía agendado. Cubre el deshacer y el caso que era un bug igual sin ningún deshacer. Lo que NO cubre: un primer paso con delay 0 sale en el mismo movimiento, y el cron de nutrición corre una vez por hora, así que demorarlo convierte «al instante» en «en algún momento de la próxima hora»: decisión de producto.",
      "Y dos cosas pagadas en la misma tanda: un respaldo que cubría 3 de 4 columnas restauró diciendo «verificado» (la columna nueva entra al respaldo el mismo día que al modelo), y ofrecer la sección de entrega sólo con un producto ya elegido dejaba el desplegable con UNA sección — o sea, una capacidad que no se podía ni descubrir.",
    ],
    commits: [
      { sha: "1e668734", msg: "Las secuencias de la ENTREGA: evento propio, ambito por PRODUCTO", lineas: 285, archivos: 10 },
      { sha: "446ef9b5", msg: "Salir de una etapa de entrega CIERRA lo que esa etapa tenia agendado", lineas: 120, archivos: 3 },
      { sha: "d6ed9f7d", msg: "El selector ofrece las etapas de la ENTREGA, en su propia seccion", lineas: 216, archivos: 6 },
    ],
  },
];
