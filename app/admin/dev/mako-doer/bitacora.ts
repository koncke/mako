// =============================================================================
// MaKo Doer — el registro de construcción del área
// =============================================================================
// Alcance: el agente que ESCUCHA en los grupos de WhatsApp y actúa. Decide si
// contesta, junta el lote de mensajes, elige el tier del modelo por turno, corre
// el loop de tools y —lo que se ganó en agosto— decide QUÉ hacer por código
// antes de dejar hablar al modelo. NO es el chat dentro de la app.
// Vive en: lib/mako-doer-in.ts, lib/mako-doer-acciones.ts, lib/mako-doer-buffer.ts,
// lib/mako-doer-conv.ts, lib/mako-router.ts, lib/mako-intencion.ts,
// lib/respuesta-doer.ts, app/api/webhooks/evolution/, app/api/admin/mako-doer/.
//
// De dónde salió esto: los mensajes de commit de la seguidilla del 9 al 13 de
// agosto —que son largos a propósito y explican el porqué—, más
// docs/hallazgos-ia.md (las tools del doer, la confirmación entre turnos, los
// requisitos que el canal no puede cargar) y docs/hallazgos-comunicacion.md (el
// lote, el eco y la ventana de audio).
//
// NO es un changelog. Lo que git ya guarda no se repite acá: va el motivo, la
// trampa y —sobre todo— cuándo el diagnóstico obvio era el equivocado.

import type { Hito, Parte } from '../_registro/tipos';

export const PARTES: Parte[] = [
  { titulo: 'Escuchar en el grupo', detalle: 'Webhook de Evolution · lote por ventana de silencio · audio transcripto · acuse ANTES de la espera, no después', estado: 'hecha' },
  { titulo: 'El router: cuánto gastar', detalle: 'lib/mako-router.ts elige el tier del modelo por turno · contesta CUÁNTO, nunca QUÉ', estado: 'hecha' },
  { titulo: 'La intención: qué hacer', detalle: 'lib/mako-intencion.ts · catálogo CERRADO, clasificación determinística y un contrato por intención (qué tools ve, si la tool es obligatoria, qué se valida al salir)', estado: 'hecha' },
  { titulo: 'Nada se escribe sin confirmar', detalle: 'El borrador del plan y la propuesta de lead salen como LINK a una pantalla de MaKo · el mensaje lo escribe el CÓDIGO, no el modelo', estado: 'hecha' },
  { titulo: 'Escribir de verdad (CRM, etapas, presupuesto)', detalle: 'confirmar_accion + mako_pendientes con guarda de turno · falta cerrar los requisitos que el canal no sabe cargar', estado: 'sigue' },
  { titulo: '«Hola MaKo» y la memoria de la charla', detalle: 'Reporte del dueño sin cerrar (15/07): no funciona, los audios tampoco, y no recuerda el histórico de la conversación', estado: 'cola' },
];

export const BITACORA: Hito[] = [
  // ── 9 de agosto: el borrador que salió como texto ──────────────────────────
  {
    fecha: '9 ago', hora: '10:17', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'correccion',
    titulo: 'MaKo contestó con el formulario entero: la guarda va pegada al envío',
    puntos: [
      'El dueño pidió cargar dos tareas y recibió el **borrador entero como texto** en el chat, con las preguntas del formulario ahí mismo. Sus palabras: «me comenzó a preguntar allí mismo en el chat, cuando existe justamente la metodología de enviar el link» y «no entiendo qué hizo». **No entendía porque MaKo no hizo nada**: no hubo INSERT, no hubo id, no hubo link — solo redactó.',
      '⚠️ **Lo que salió era el `input_schema` de la tool aplanado a markdown.** El `MOLDE_DETALLE` va literal en la description del campo `detalle`, y **con un modelo chico el schema viaja como prompt plano, indistinguible de una instrucción**. La regla que queda para cualquier tool: lo que escribís en una description no es documentación, es texto que el modelo puede decidir *ejecutar*.',
      '⚠️ **NO fue el modelo ni una regresión.** El día anterior acertó cuatro veces con el mismo modelo y la misma ruta, y la línea culpable es idéntica los dos días: el único filtro para mandar la prosa del modelo al WhatsApp del dueño era que **no empezara con un paréntesis**. «Este turno crea un borrador» no existía como decisión del código: la tomaba el modelo emitiendo (o no) un tool_call.',
      '**Y no alcanzaba con «¿llamó alguna herramienta?»**, que era la guarda que ya existía apagada detrás de un flag: ese día el modelo SÍ llamó una tool (`ver_plan`, 6 tokens) y redactó igual. **La pregunta correcta es «¿ocurrió el EFECTO que la ruta exigía?»**, y de eso hay prueba dura: `linkBorrador`, que solo se setea cuando el INSERT pasó.',
      '⚠️ **Y la regresión de la misma mañana, que es el hallazgo más caro de la tanda: mi guarda descartaba lo bueno, que es peor que no tener guarda.** El loop de proveedores miraba `.ok` a secas, y `!ok` cubre las DOS razones — pero `sin-borrador` se diseñó como señal **blanda** (existe para loguear: hay turnos de plan que legítimamente no crean nada). Con eso, una respuesta corta y correcta descartaba proveedor tras proveedor hasta agotar los cinco, y al dueño le salió «falló la IA (HTTP 404)». **En el choke point las razones estaban distinguidas; en el loop se habían colapsado en un booleano** — y ahora hay un test que falla si vuelven a colapsarse.',
      'De paso, lo de fondo: `tool_choice` estaba hardcodeado en `auto` en `chatCheapTools` mientras el hermano de Claude tiene `toolChoice` desde siempre. En la ruta de plan la acción **ya la decidió el router**, así que `auto` es pedirle permiso al modelo para hacer lo que ya se resolvió. Se fuerza en el PRIMER paso y se libera después (forzarlo en todos es un bucle: nunca podría contestar).',
    ],
    commits: [
      { sha: 'd5cd8a90', msg: 'MaKo no puede mandarte el borrador: tiene que mandarte el LINK', lineas: 271, archivos: 5 },
      { sha: '32432274', msg: 'Mi guarda descartaba lo bueno, que es peor que no tener guarda', lineas: 72, archivos: 4 },
    ],
    archivos: [
      'lib/respuesta-doer.ts — la compuerta, SIN `server-only` para poder testearla',
      'lib/mako-doer-in.ts — el loop de rotación de proveedores y la compuerta antes de enviar al grupo',
      'docs/hallazgos-ia.md — la entrada de la corrida `doer-borrador-roto`',
    ],
  },
  {
    fecha: '9 ago', hora: '11:30', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El acuse tardaba 8 segundos, y seis puntos numerados daban una tarea',
    puntos: [
      '⚠️ **Un comentario que era cierto el día que se escribió.** «Dale, anoto eso» vivía en `procesarDoer`, o sea **detrás** de `esperarSilencio`: el comentario de ahí decía «lo mandamos ACÁ, lo primero» y lo era — el **buffer llegó después** y lo empujó atrás sin que nadie tocara esa línea. Es la forma silenciosa en que una pieza nueva rompe la premisa de una vieja: no hay diff que lo muestre.',
      '⚠️ **Seis puntos numerados dieron UNA tarea, y no fue el techo de tokens**: gastó 933 de 2500. **Resumió.** El preámbulo explicaba con detalle cómo agrupar tareas en proyectos y no decía nada de cuántas TAREAS salen de un mensaje, así que el único que sabía que eran seis era el dueño. Ahora **las cuenta el código** (`lib/puntos-mensaje.ts`) y se le pasan al prompt como un hecho — con el cuidado del error opuesto: un guion en medio de una frase no es un ítem, «2026» no es una enumeración, y los numerados le ganan a las viñetas de adentro.',
      'La regla general de las dos: **cuando un modelo devuelve menos de lo que había, el sospechoso no es el techo de tokens sino que nadie le dijo cuántos había.** El dato exacto lo produce el código y viaja como hecho, no como pedido.',
    ],
    commits: [{ sha: 'caf26b15', msg: 'Cinco cosas del borrador por WhatsApp', lineas: 273, archivos: 6 }],
  },

  // ── 10 de agosto: el link inventado ────────────────────────────────────────
  {
    fecha: '10 ago', hora: '13:39', chat: '—', cuenta: 'claude1',
    actor: 'claude', tipo: 'correccion',
    titulo: '«Este borrador ya no existe»: el modelo escribió un id plausible',
    puntos: [
      'MaKo contestó «Listo, te armé el borrador» con un link, y al abrirlo no había nada. **No había porque nunca se creó**: tres llamadas de 79, 6 y 47 tokens, ningún INSERT, y un id inventado de 16 caracteres donde los de verdad tienen 17. Es el corolario que AGENTS.md ya tenía escrito —un dato exacto que pasa por las manos de un LLM deja de ser exacto—, con el agravante de que el id no tiene ninguna redundancia: el modelo lo escribe casi bien y nadie lo nota hasta el clic.',
      '⚠️ **Por qué no lo atajó la guarda del día anterior: colgaba de otra heurística.** La señal `sin-borrador` solo se evaluaba en la ruta `(plan)`, y el router clasificó ese turno como `(dato/acción)`. **Colgar una detección de que el router acierte es colgarla de una segunda heurística** — la señal nueva no mira la ruta: si hay un link de `/plan/revisar/` en el texto y `linkBorrador` es null, es inventado, venga de donde venga.',
      '**Un link roto es peor que un «no pude»**: el dueño hace clic, lee «este borrador ya no existe» y pierde lo que escribió sin saber por qué. Por eso la señal es dura (descarta la respuesta) y la salida honesta es el «no pude».',
      '⚠️ **Y al día siguiente el mismo link inventado se volvió la CURA.** La guarda funcionó —no salió un link roto— pero el dueño quedó igual sin nada. Ninguna de las dos señales de intención había visto ese turno: el router lo mandó a `(dato/acción)` y `esCargaDePlan` pide un «anotá» o una lista numerada, y el mensaje era prosa con links. **Pero el link inventado dice algo que ninguna heurística sabía: el modelo CREÍA que estaba armando un borrador.** Es la señal de intención más limpia que hay —la da él, sobre ese mensaje concreto— y llega tarde pero llega: ahora se reintenta una vez con `tool_choice: required`, y el escalado a Claude ya no depende de que el router haya acertado.',
      'En el mismo arreglo, el error técnico dejó de salir por WhatsApp: al dueño le llegaba el mensaje del **último** proveedor que reventó, que puede no tener nada que ver con la causa (los anteriores se descartaron por otra razón y su error quedó pisado). Afuera va lo único que le sirve saber —si su trabajo se guardó o no—; el detalle, al log.',
    ],
    commits: [
      { sha: 'd8867e04', msg: '«Este borrador ya no existe»: el modelo inventó el link', lineas: 88, archivos: 3 },
      { sha: '19f1b2f0', msg: 'El link inventado es la prueba de que quiso armar el borrador', lineas: 37, archivos: 1 },
    ],
  },
  {
    fecha: '10 ago', hora: '14:25', chat: '—', cuenta: 'claude1',
    actor: 'martin', tipo: 'prompt',
    titulo: '«El modelo jamás debe ser el responsable de mandar ese mensaje»',
    pedido: 'el modelo de IA jamás debe ser el responsable de mandar ese mensaje… si literalmente SIEMPRE es el mismo y lo único que cambia es la variable del link',
    puntos: [
      '**Es la corrección de fondo, y explica por qué ninguno de los arreglos anteriores alcanzaba.** La pila que había eran cuatro redes debajo de una decisión que no había que tomar: (1) el prompt le pedía al modelo que escribiera la frase con el link; (2) como copiaba mal los 17 caracteres → `corregirLinkBorrador`; (3) como a veces lo inventaba entero → una guarda que lo detecta; (4) y una cuarta capa para el caso que la tercera no cubría. **Cada capa arreglaba el síntoma de la anterior.**',
      'La regla que queda: **darle a un modelo una salida que no tiene NI UNA variable de libertad es el error**. Si hay borrador, la respuesta ES `mensajeBorrador(link)` — no se corrige la del modelo, se **reemplaza**. Su trabajo termina cuando llama la tool, y el prompt se lo dice así.',
      'La compuerta se simplifica sola: llegar ahí ya solo es posible SIN borrador, así que las dos razones duras que quedan significan lo mismo (el modelo dijo que hizo algo que no hizo). Y tres tests fijan lo que importa, incluido que **la salida del código pase su propia compuerta** — si no, reemplazar crearía un bloqueo infinito.',
      '⚠️ **El mismo día, otra cadena rota: el eslabón que PROPONE el nombre de un proyecto no conocía la regla que aplica el eslabón que lo juzga.** MaKo propuso «Agentes IA para MaKo» —sin prefijo y en español—, el Perro no lo reconoció como proyecto nuevo válido y reusó el más parecido. Y **estaba escrito**: arriba de `REGLA_NOMBRE_PROYECTO` dice textual «lo lee el ruteo del Perro, LA TOOL DE WHATSAPP y la skill de Claude Code», y la tool de WhatsApp no importaba nada de ese módulo. **El comentario describía una intención, no el código.**',
    ],
    commits: [
      { sha: '00a58be6', msg: 'El mensaje del borrador lo escribe el código, no el modelo', lineas: 69, archivos: 2 },
      { sha: '69aaf5fa', msg: 'La regla del nombre de un proyecto NO le llegaba a MaKo por WhatsApp', lineas: 12, archivos: 2 },
    ],
    archivos: ['lib/mako-doer-acciones.ts — las tools del doer; la regla del nombre entra por la description y por `canonNombre` en el saneo'],
  },

  // ── 11 y 12 de agosto: dejar de prometer, y decidir por código ─────────────
  {
    fecha: '11 ago', hora: '17:39', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Los mensajes que preguntaban al vacío, y el agendado que por fin tiene salida',
    puntos: [
      'El dueño mostró su WhatsApp: «muchos están incompletos, como el que te pregunta ¿Querés que te pase el resumen y las objeciones acá? y al final no hace nada». ⚠️ **El diagnóstico obvio era el equivocado**: no faltaba cablear la respuesta. El aviso se emitía **en el instante del webhook de Fathom** y el Closing Analyst corre después, adentro del `after()` — **cuando MaKo ofrecía el resumen, el resumen todavía no existía**. El aviso se movió adentro del `after()`, después del análisis, y sale igual si el análisis falla.',
      '**Una promesa que el canal no puede cumplir es peor que el silencio**, y es la misma clase de bug que el «lo ingreso directo al CRM» de dos días después: MaKo ofreciendo algo para lo que no existía ninguna tool.',
      '⚠️ **Agendar: el diagnóstico anterior también era el equivocado, y queda escrito.** No era «reconectar Zoom». Se probaron CINCO formas del pedido y las cinco dan el mismo error — **si el error no cambia cuando cambia lo que mandás, el problema no es lo que mandás**. La salida la sugirió el dueño sin saberlo: el embed de Calendly funciona porque lo completa una persona en un navegador, así que el doer manda **ese mismo formulario prellenado** por WhatsApp, con link de un solo uso. Intenta la reserva directa y cae al formulario si Calendly la rechaza: el día que lo arreglen, el agendado directo arranca solo.',
      '⚠️ **Trampa de UI que muerde a cualquier pantalla nueva del CRM:** `MakoConfirmGate` dispara un modal bloqueante en todo `/crm*`, así que **una pantalla nueva bajo ese prefijo nace tapada**. Por eso existe `esVistaSinChrome`, separado de `isPublicLandingPath` (que significa otra cosa y gobierna los pollers).',
    ],
    commits: [
      { sha: 'b4714a82', msg: 'Los mensajes de MaKo dejan de preguntar al vacío: un link al resumen del lead', lineas: 1333, archivos: 16 },
      { sha: '4c952691', msg: 'Mensajes de MaKo tiene lugar propio en la barra, y agendar tiene salida', lineas: 178, archivos: 8 },
    ],
  },
  {
    fecha: '12 ago', hora: '11:32', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El doer decide QUÉ hacer por código: el router contestaba cuánto gastar, y nada más',
    puntos: [
      'El dueño mandó «Investigar competencia: <2 links>» para que quedara ANOTADO y recibió un ensayo de dos pantallas **sobre otras cosas**: el branding que había mandado 33 h antes y una idea de contenidos de 25 h antes. Ninguna estaba en el mensaje, y el análisis era **inventado** — escribió «lo que vi» sobre links que no puede abrir.',
      '⚠️ **No fue «el modelo se equivocó».** Los CINCO mensajes anteriores tenían la misma forma y los cinco terminaron en borrador; corriendo `rutearDoer` sobre los seis, **los seis caen en la misma ruta**. Mismo mensaje, misma ruta, y el resultado lo decidía el modelo cada vez. **Salía bien casi siempre, que es otra cosa que salir bien.**',
      '**CAUSA RAÍZ: `mako-router` contesta CUÁNTO GASTAR y nadie contestaba QUÉ HACER.** Solo la ruta `(plan)` acotaba las tools y forzaba la llamada; todo lo demás recibía las veinte tools y cero obligación. Peor: medido sobre sus mensajes reales, el mismo tipo de volcado se ruteaba de cinco formas distintas y **una era `cheap`, sin tools** — por ahí una idea no podía llegar al plan ni queriendo. `lib/mako-intencion.ts` es el catálogo CERRADO con el contrato de cada intención.',
      '**La señal que más rinde salió de leer 20 mensajes suyos: INFINITIVO vs IMPERATIVO.** «Investigar competencia» es el título de una tarea; «investigá la competencia» es una orden a MaKo. En rioplatense los separa una tilde, y **ningún prompt va a respetar eso** — es exactamente lo que hay que escribir en código.',
      "⚠️ **Dos bugs que solo aparecieron midiendo.** (a) `\\b` después de una vocal acentuada **no es frontera de palabra en JS**: «sí, dale» no matcheaba la confirmación, y el MISMO error vive en `CONFIRMACION_PELADA` —el guard que impide que un «sí» pelado invente tareas—, o sea que ahí no protege. (b) El historial entraba como mensajes `user` idénticos al de ahora: **para el modelo TODO era el pedido**, por eso contestó sobre material de anteayer. Ahora entra marcado como CONTEXTO y la ventana baja de 48 h a 14 h.",
      'Los 9 tests nuevos usan **los mensajes REALES de `mako_doer_conv` como corpus**: si un volcado suyo deja de capturarse, ese mensaje se habría perdido. Un umbral o una heurística de lenguaje sin el corpus real es una opinión.',
    ],
    commits: [{ sha: '5cc21311', msg: 'El doer decide QUÉ hacer por código, no a mano alzada', lineas: 483, archivos: 5 }],
    archivos: [
      'lib/mako-intencion.ts — el catálogo cerrado de intenciones y el contrato de cada una',
      'lib/mako-router.ts — sigue contestando SOLO cuánto gastar',
      '⚠️ Vivo: el `\\b` tras vocal acentuada en `CONFIRMACION_PELADA`',
    ],
  },

  // ── 13 de agosto: el lead por WhatsApp ─────────────────────────────────────
  {
    fecha: '13 ago', hora: '16:57', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La tarjeta de contacto llegaba y MaKo decía que no había llegado nada',
    puntos: [
      'Leila (ws11) quiso cargar un lead desde el grupo, compartió **la tarjeta de contacto** y MaKo contestó «No me llegó ningún dato ni contacto». **Es literalmente falso: el mensaje llegó.** `textoDe` leía conversation / extendedText / caption y `adjuntoDe` solo imagen y documento, así que un `contactMessage` entraba, no producía ni texto ni adjunto, y MaKo concluía que no había venido nada. **Compartir el contacto es LA forma natural de pasar un lead por WhatsApp** —nadie tipea un número que ya está en la agenda— y era justo lo único que no se entendía.',
      '**Y había un segundo problema debajo, peor: aunque hubiera leído los datos, no existía forma de cargar un lead desde WhatsApp** (`grep proponer_lead` daba cero). La respuesta de MaKo, «lo ingreso directo al CRM», era una promesa que no podía cumplir.',
      '⚠️ **La trampa del vCard, medida:** la clave viene como `TEL;type=CELL;waid=…`, no como `TEL` — comparar contra `TEL` a secas deja el teléfono en null **justo cuando el contacto viene de WhatsApp**. Se prefiere el `waid` al número visible porque es el internacional limpio, que es con el que después matchea su chat. Y acepta `contactsArrayMessage`: compartir dos contactos juntos se perdía entero, en silencio.',
      '**El lead entra como PROPUESTA, no como escritura**: misma tabla y misma pantalla que ya usa el agente de Claude, con `ref` idempotente por teléfono — sin eso, el buffer de WhatsApp deja dos tarjetas del mismo lead y se confirma un duplicado creyendo que son dos personas.',
      '⚠️ **Sin una intención propia, el arreglo habría sido peor que el bug.** «Compartió un contacto» caía en el default («sin señal clara → capturar») y el lead terminaba de **tarea en el plan** — encima parecería que funcionó.',
      '⚠️ **Y el remate del día: «Anotado» sonaba a hecho.** El alta funcionó bien (MaKo propuso en vez de escribir), y Leila igual entendió que el contacto ya estaba en el CRM porque el modelo redactó «Anotado los datos de… Revisalo y sumalo directo al CRM desde acá». Las dos frases son razonables sueltas y juntas dicen lo contrario de lo que pasó. **El arreglo no es pedirle al modelo que lo diga mejor: es sacarle la frase** — el mensaje lo escribe el código, con el nombre sacado del INPUT de la tool, y dice tres cosas en orden: de quién se habla, que TODAVÍA no está cargado, y qué falta para que esté. **La regla, para cuando MaKo pueda tocar el CRM y subir campañas: el ESTADO de un dato no puede depender de cómo le salió la frase a un LLM.**',
    ],
    commits: [
      { sha: '0428a053', msg: 'MaKo lee la tarjeta de contacto, y ya puede cargar el lead', lineas: 327, archivos: 5 },
      { sha: '82512ab4', msg: '«Anotado» sonaba a hecho: el mensaje del lead lo escribe el código', lineas: 94, archivos: 3 },
    ],
    archivos: [
      'lib/vcard.ts — el parser, SIN `server-only` para poder testearlo',
      'lib/mako-doer-acciones.ts — la tool `proponer_lead` y el mensaje que escribe el código',
      'lib/propuestas.ts — la tabla única de propuestas (mig 0128), la misma que usa el agente de Claude',
    ],
  },
  // ── 7 de octubre: agendar y mover en Google Calendar desde el grupo ──────────
  {
    fecha: '7 oct', hora: '20:54', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Que el cliente agende y mueva reuniones escribiéndole al grupo de MaKo',
    pedido: 'Y ellos lo que quieren hacer es que si le escriben al grupo de WhatsApp de MaKo, y le dicen que agende X reunión con X cliente, o modifiquen, eso lo puedan hacer desde el WhatsApp de MaKo',
    puntos: [
      'Llegó junto con el error de Google Calendar del cliente inmobiliario (ws13): su documento de pedidos dice «Permitir conectar el Google Calendar de cada inmobiliaria con MaKo».',
      'Eligió hacerlo **por Google Calendar** y no por Cal.com, que es lo que ese cliente usa para reservas.',
    ],
  },
  {
    fecha: '7 oct', hora: '20:54', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Agendar y mover en Google desde WhatsApp: la parte difícil no era escribirlo',
    puntos: [
      '**Agendar por WhatsApp ya existía, pero SOLO por Calendly** y atado a R1/R2. El ws13 usa Cal.com (medido en la base) y **mover no existía por ningún canal**. Se sumaron tres operaciones al registro: `reuniones_agenda_lead`, `proponer_agendar_agenda` y `proponer_mover_reunion`, con confirmación por chat.',
      '**La fecha y la hora las pasa el modelo como las dijo la persona y el instante lo arma el código** (`instanteDeLocal`, la misma conversión de la grilla del CRM, con el horario de verano resuelto). Y **mover nunca crea una reunión nueva** si no encuentra la nombrada: crearla mandaría una invitación a algo que nadie pidió.',
      '⚠️ **Lo que decidía si funcionaba era otra cosa: si la tool LLEGA al modelo.** Las del registro entran al turno sólo si el mensaje nombra el área, y «visita» y «cita» no estaban — «pasá la visita de Juan al viernes» llegaba sin ninguna. Y la lectura que mover necesita quedaba afuera del presupuesto de 12.000 caracteres con «reagendá», porque su título no tenía esa raíz: **la herramienta para mover entraba y la que dice QUÉ mover no.** Lo cazó el test, que arma el turno con los números reales.',
      '⚠️ **El doer no le decía al modelo qué día es**: «el jueves» lo tenía que adivinar. Ahora va HOY, en la zona del negocio.',
      '**No se probó contra una agenda real**: el único workspace con Google conectado es el ws1, un cliente, y probar ahí es mandarle una invitación real. La primera prueba es el primer uso del ws13.',
    ],
    commits: [
      { sha: 'c3c2ef17', msg: 'Agendar y mover reuniones en Google Calendar desde el grupo de MaKo', lineas: 539, archivos: 6 },
    ],
    archivos: [
      'lib/google-calendar.ts — `crearEventoDeReunion`, `proximasReunionesCon`, `choquesEnAgenda` y `crearSiNoExiste` en mover',
      'lib/api-mako/areas/crm.def.ts + crm.run.ts — las tres operaciones del registro',
      'lib/mako-intencion.ts — `visita`, `cita`, `calendario` y `reagend` activan el área CRM',
      'lib/mako-doer-in.ts — HOY en la zona del negocio, en los turnos con herramientas',
      'tests/agenda-whatsapp.test.ts — arma el turno con frases reales; probado rompiéndolo',
    ],
  },
  // ── 8 de octubre: rotar de proveedor duplicaba las pendientes ────────────────
  {
    fecha: '8 oct', hora: '00:05', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Evitar pendientes duplicadas al rotar de proveedor',
    pedido: 'Haz esta tarea aquí: “Evitar pendientes duplicadas al rotar de proveedor”',
    puntos: [
      'La tarea salió de la revisión adversarial del rediseño de la agenda (7/10): un refutador confirmó, leyendo el código, que el doer repetía las acciones al rotar de proveedor.',
    ],
  },
  {
    fecha: '8 oct', hora: '00:05', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Rotar de proveedor ya no duplica: lo que una acción hizo vuelve sin correr',
    puntos: [
      '**El doer vuelve a correr el turno ENTERO en cinco caminos** (otra cuenta, la tool forzada, la red de plataforma, Claude, Groq). Si el primer proveedor proponía y se caía, el segundo volvía a proponer, y `crearPendiente` era un INSERT pelado: dos pendientes iguales, un «sí» que contestaba «Hay 2 acciones pendientes, aclara cuál» y, confirmadas las dos, dos invitaciones.',
      '⚠️ **La guarda que ya había cubría UN camino de cinco**: «no rotes si ya hay borrador» miraba el link sólo en la rotación por validación; el `continue` de «contestó sin texto» y el `catch` rotaban igual.',
      '**Dos capas.** En el doer, un memo por turno: cada corrida recibe `nuevoIntento()` y lo que una acción hizo en un intento anterior se le devuelve sin correr (dentro de un intento se cuenta por orden, mover dos leads es legítimo). En los datos, la misma pendiente no se guarda dos veces en un turno — sólo en el turno, para no saltear el candado de «no se confirma en el mismo turno en que se propuso».',
      '⚠️ **No se cortó la rotación**, que era la salida que aparecía primero: dejaría muda a la persona cuando el primer proveedor se cae después de proponer, y es lo que sostiene a un cliente con una sola key.',
      '**SIN HACER:** las propuestas de pantalla del registro sin `ref` (`proponerPantallaGenerica`) no tienen red de datos; un mismo intento que llama dos veces la misma acción deja dos links.',
    ],
    commits: [
      { sha: 'cf365907', msg: 'Rotar de proveedor ya no duplica pendientes: lo que una acción hizo en el intento anterior vuelve sin correr', lineas: 415, archivos: 8 },
    ],
    archivos: [
      'lib/turno-sin-duplicar.ts — el memo de acciones y `pendienteRepetida`, puros y con test',
      'lib/mako-doer-in.ts — `nuevoIntento()` en las seis corridas del turno',
      'lib/mako-pendientes.ts — `crearPendiente` con `mismoTurnoDesde`',
      'tests/turno-sin-duplicar.test.ts — 10 tests, probado con 12 roturas',
    ],
  },
  {
    fecha: '8 oct', hora: '—', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Todas las acciones de MaKo, modularizadas como una API',
    pedido: 'Yo creo que algo importante, y también para todo el tema de chatbot que estamos haciendo, es tener muy bien modularizado todas las acciones de MaKo...\n\nNo se como recomiendas hacerlo, pero yo me imagino que cada acción, sea algo como /crm-lead-X\nO algo así, que sea como la documentación de "API" que hicimos en su momento, no recuerdo si en esta cuenta o en la otra...\nQue basicamente MaKo tenga una API propia, con todas las acciones bien documentadas y moduladas, como un CRUD de cosas que se pueden hacer dentro de MaKo y así nos podemos ahorrar muchos tokens en la busqueda. Y también muy importante, podemos configurar acciones en el chatbot y en otros lugares que se pueda integrar la API de MaKo.',
    puntos: [
      'Viene después del «sin cuota» de Brigitte: una pregunta al doer son 6-8 pedidos de ~15.000 tokens.',
    ],
  },
  {
    fecha: '8 oct', hora: '—', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'La API ya existe; lo que falta es que el doer y los flujos pasen por ella',
    puntos: [
      '**Medido:** el registro tiene 498 operaciones en 18 áreas, con su ruta `/api/v1/{área}/{operación}` y la referencia generada. Pero las 25 herramientas más usadas viajan al doer con su copia VIEJA, y las dos copias ya divergieron en 3 arreglos.',
      '**Dónde se van los tokens de una pregunta:** 54% son esquemas de herramientas (las 25 viejas, el 33%) y la receta del plan viaja en preguntas que no cargan tareas. El prefijo re-enviado en cada paso es el 90-96% del input; los resultados de las tools, ~5%.',
      '⚠️ **Dos supuestos del plan cayeron al refutarlos:** Gemini ya cachea el 86% del prefijo (la tabla decía 0 porque no se leía), y no se sabe si el tope del 07/10 fue de pedidos o de tokens — si es de pedidos, cargar esquemas a pedido empeora.',
      '**Chatbot:** ninguna automatización pasa por el registro, y el paso «⚡ Acción» del lienzo de avisos no hace nada al confirmarse. El canal `flujo` espera la decisión de qué puede correr solo.',
      '**De paso:** todo el gasto de Meta se lee en dólares como si la cuenta cobrara en pesos; para Código Inmobiliario (USD) sale 17,3 veces más chico. Va como tarea aparte.',
    ],
    commits: [
      { sha: '949bd68b', msg: 'IA: se anota lo que Gemini cachea, y qué tope se pasó en un 429 queda adelante', lineas: 57, archivos: 4 },
    ],
    archivos: [
      'docs/api-mako-diseno.md — § 10: el orden de las fases y las decisiones de Martín',
      'docs/hallazgos-api-mako.md — las 25 dobles, /api/agente, los huecos que un flujo necesita',
      'docs/hallazgos-ia.md — la anatomía de los tokens y el caché de Gemini',
    ],
  },
  {
    fecha: '8 oct', hora: '—', chat: '—', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Las cinco decisiones, y «solucionalo end-to-end»',
    pedido: 'Lo que tenés que decidir:\n\n* Que pueda hacer todo, sin limitaciones.\n* La ofrece.\n* No, no renombres.\n* Mantenla, no cambies nada.\n* No, no lo escondas...\n\n\nCon todo esto, solucionalo end-to-end...\nPrimero la optimización de los tokens para MaKo en WhatsApp. Y segundo la implementación de todas estas acciones en el chatbot. Y tercero, manda toda la info que tienes al chat de API de MaKo, para que cree la tab de API y que sea 100% funcional.',
    puntos: [
      'Contesta las cinco decisiones de docs/api-mako-diseno.md § 10: un flujo hace todo sin pedir el sí; en una pregunta MaKo ofrece la acción; no se renombra; /api/agente queda igual; el paso «⚡ Acción» no se esconde.',
    ],
  },
  {
    fecha: '8 oct', hora: '03:33', chat: '—', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'En una pregunta MaKo ofrece, y viajan 4.535 tokens menos por pedido',
    puntos: [
      '**En consultar/pensar no viajan las herramientas que escriben** (lo dice el `tipo` del registro): las 7 `proponer_*` viejas y confirmar/cancelar eran 10.380 caracteres en cada pedido del turno. MaKo ofrece la acción en una línea y el «sí» llega como `actuar`, con todo.',
      '**Las recetas del protocolo viajan con su herramienta** (`lib/doer-recetas.ts`): la de cargar tareas al plan ya no va en una pregunta del CRM. El protocolo de una pregunta bajó de 8.481 a 1.164 caracteres.',
      '⚠️ **El refutador cazó el agujero del plan:** el «sí» a una pregunta caía en `charlar` o `pensar`, sin herramientas de escritura. Sin tocar el clasificador, MaKo habría ofrecido algo que después no podía hacer.',
      '**Medido:** −4.535 tokens por pedido en una pregunta (−31% de 14.491). En `actuar` no cambia nada.',
    ],
    commits: [
      { sha: '3950e7cd', msg: 'MaKo por WhatsApp: en una pregunta ofrece la acción, y viajan 4.535 tokens menos por pedido', lineas: 265, archivos: 4 },
      { sha: 'f9302e58', msg: 'Guard de voseo: las recetas del doer mudadas a lib/doer-recetas.ts tienen la misma excepción', lineas: 4, archivos: 1 },
    ],
    archivos: [
      'lib/doer-recetas.ts — las recetas y `recetasDelTurno`, puras',
      'lib/mako-intencion.ts — `makoPreguntoAlgo` y la regla 3-ter: el «sí» al ofrecimiento es `actuar`',
      'lib/mako-doer-in.ts — el filtro de escrituras en una pregunta',
      'tests/doer-recetas.test.ts — 5 tests, cinco roturas',
    ],
  },
  // ── 8 de octubre: la agenda de Joan no llegaba a ninguna herramienta ──────────
  {
    fecha: '8 oct', hora: '14:44', chat: 'CRM', cuenta: 'claude2',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Joan no puede crear ni editar su agenda por WhatsApp',
    pedido: 'El calendar integrado bien, pero no me deja modificar la agenda (crear editar y esas cosas). Fijate que lo estuvo intentando en el WhatsApp de MaKo con Código Inmobiliario.',
    puntos: [
      'Lo pasó la sesión del CRM con el diagnóstico y la refutación ya medidos (solo lectura). Joan había escrito «Mako, agenda me una reunión mañana 12hs de 1hs que se llame PRUEBA» un minuto después de conectar su Google, y MaKo contestó «por aquí no puedo agendarte».',
    ],
  },
  {
    fecha: '8 oct', hora: '14:44', chat: 'Integraciones', cuenta: 'claude2',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'La agenda por WhatsApp: crear, mover, cambiar y cancelar, con o sin lead',
    puntos: [
      '⚠️ **La conexión estaba bien; el pedido nunca llegó a una herramienta.** «agenda» sin tilde y el pronombre suelto no eran ningún imperativo, así que el mensaje se guardó como material para anotar. Ahora hay una regla de pedido de agenda: verbo + reunión + día u hora, con las formas «me puedes agendar…».',
      '⚠️ **El test estaba verde sobre el bug**: armaba el turno a mano, sin el clasificador. 3 de sus 5 frases de escritura llegaban sin la herramienta en el turno real. La selección pasó a una función pura que llaman el doer y el test.',
      '**El «sí» a un ofrecimiento, la corrección de una propuesta («no, mejor a las 13») y un lote de mensajes** tampoco traían la acción: el presupuesto ordena por relevancia contra el TEXTO, y «sí, dale» no nombra nada.',
      '**Lo que faltaba de verdad:** crear un evento sin lead (sin invitados), ver el día entero, cambiar nombre o duración, y cancelar. Sin lead se busca por el día y la hora que dijo la persona; la agenda sigue sin pasar por la IA y cada escritura espera el «sí».',
      '**Y a un negocio sin Calendly ya no le viaja Calendly**, cuya receta empujaba a pedir un lead y un email. Aparte, MaKo le decía «Martín» a Joan: los encuadres del system nombraban al dueño para todo cliente.',
      '**No se probó contra una agenda real**: la del ws13 es de un cliente.',
    ],
    commits: [
      { sha: '6d8655ca', msg: 'MaKo por WhatsApp agenda, mueve, cambia y cancela en Google Calendar, con o sin lead', lineas: 1456, archivos: 17 },
    ],
    archivos: [
      'lib/mako-intencion.ts — `esPedidoAgenda`, `corrigeAgenda`, `sinPrefijoDeLote`, `RELEVANCIA_AGENDA`',
      'lib/doer-herramientas.ts — la selección de herramientas del turno, pura (la usan el doer y el test)',
      'lib/agenda-sin-ia.ts — ver el día, cambiar y cancelar, con centinelas',
      'lib/google-calendar.ts — `eventosDelDia` (estricta), `cancelarEventoDeReunion`, `cambiarEventoDeReunion`',
      'lib/api-mako/areas/crm.def.ts + crm.run.ts — agenda_del_dia, proponer_cambiar_reunion, proponer_cancelar_reunion, y agendar y mover sin lead',
      'tests/agenda-whatsapp.test.ts — reescrito sobre el turno real; 15 roturas entre los dos tests',
    ],
  },
  // ── 17 de octubre: el vigía de los grupos, y el «no puedo» de Pablo ─────────────
  {
    fecha: '17 oct', hora: '01:50', chat: 'Cerebro', sesion: 'local_797d5445-2365-464d-ae3d-1d71aa7baa8c', cuenta: 'claude4',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Que se vigilen SIEMPRE todos los grupos de MaKo y los errores se arreglen solos',
    pedido: 'quiero activar un proceso donde SIEMPRE se esté leyendo todos los grupos de MaKo en WhatsApp con clientes, porque MaKo muchas veces dice "no puedo" o tira errores, y no me gusta que no funcione, debe funcionar entero... que se esté vigilando y que se debugeen los errores en automático cuando surjan... Por ejemplo en la cuenta de Pablo hay un error con su google calendar',
    puntos: [
      'Llegó por el Cerebro, con el grupo del ws18 (Pablo Chavez) del 16/10 ya medido: «primero debes activar la integración», «Déjame ver el plan…» sin nada más, «no tengo acceso para escribir en tu Google Calendar», «te cargo las tareas» sin cargar nada, y groserías en el grupo de un cliente.',
    ],
  },
  {
    fecha: '17 oct', hora: '01:36', chat: 'MaKo en WhatsApp', sesion: 'local_d3ed9496-3ca1-4037-abc2-a59ce57d3f9d', cuenta: 'claude4',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Hecho: el vigía de los grupos, y MaKo ya no dice «no puedo» con la herramienta afuera ni promete sin hacer',
    revisar: '/second-brain?ws=18',
    puntos: [
      '⚠️ **No era Google: el permiso de Pablo estaba guardado desde las 12:03, seis horas antes.** Era el clasificador, tres veces: «probá el calendario de google» caía a material sin nada para mirar la conexión (y MaKo DEDUJO que no estaba conectado); «Hola MaKo, ¿cómo estás? ¿Me agendás…?» llegaba como pregunta, donde no viajan las que escriben (el «¿cómo estás?» no se pelaba nunca: la regex no podía matchear, y «me agendás» no era el verbo); y «Nancy, Alem 1987» —los datos que MaKo pidió con un «pásame…» sin «?»— caía a material.',
      '**Y el «Déjame ver el plan» tenía `ver_plan` en la mesa**: Gemini flash-lite, el respaldo, no la llamó. Se reintenta UNA vez con la herramienta obligatoria y, si igual promete, la oración no sale y se dice que no se hizo. Una respuesta del doer es el FINAL del turno: no hay un después.',
      '**El prompt fabricaba la promesa**: el turno sin herramientas decía, como ejemplo, «eso lo miro y te lo paso», y el ws13 lo recibió textual el 13/10. Las groserías venían de la persona de MaKo («puedes putear suave»): el doer las corta al salir; la persona no se tocó.',
      '**El vigía** (`scripts/vigia-mako-grupos.mts`, sólo lectura) lee todos los grupos cada 15 minutos y marca «no puedo», promesas, quejas, groserías, silencios y carteles. Su primera pasada encontró los del ws13 («Si 18 de noviembre» salía por el camino barato sin agenda; «Pasamelo» no reclamaba lo prometido), también arreglados.',
      '**Cómo se prueba:** el próximo pedido de agenda de Pablo en su grupo (el hilo se ve en el Second Brain del ws18). No se probó contra una agenda real: la del ws18 es de un cliente.',
    ],
    commits: [
      { sha: '4569887d', msg: 'MaKo en WhatsApp: el vigía de los grupos, y lo que le dijo «no puedo» a Pablo (no era Google, era el clasificador)', lineas: 1100, archivos: 13 },
    ],
    archivos: [
      'lib/mako-intencion.ts — `CORTESIA`, «me agendás», probar una integración, `makoPidioDatos`, `esPedidoDeAgenda` y el reclamo de una promesa',
      'lib/doer-salida.ts — `promesasDe`, `groseriasDe` y `sanearSalida` (la oración sale, no se reescribe)',
      'lib/mako-doer-in.ts — el preámbulo sin promesas ni groserías, el reintento «prometió sin hacer», el camino barato que mira la intención y el saneo antes de mandar',
      'lib/vigia-mako-grupos.ts + scripts/vigia-mako-grupos.mts — qué es un incidente, y el que lee sin escribir',
      'tests/mako-en-whatsapp-pablo.test.ts (13, 19 roturas) y tests/vigia-mako-grupos.test.ts (5, 9 roturas)',
    ],
  },
  {
    fecha: '17 oct', hora: '09:07', chat: 'MaKo en WhatsApp', sesion: 'local_d3ed9496-3ca1-4037-abc2-a59ce57d3f9d', cuenta: 'claude4',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Hecho: «reprogramame la reunión…» ya llega con la herramienta de mover (lo encontró el vigía en el ws13)',
    revisar: '/second-brain?ws=13',
    puntos: [
      'Lo primero que el vigía encontró en vivo: Joan (ws13) pidió «MaKo reprogramame la reunión de ayer viernes… con Marita Pagani, reprogramámela para el lunes a las 12» y MaKo contestó «no tengo acceso para mover o reprogramar eventos de tu calendario».',
      '⚠️ **La gemela de «reagendá» del 07/10, y su familia no se buscó entonces**: `\\bprograma` no matchea adentro de «reprograma». El pedido caía al default, sin ninguna herramienta de agenda. Ahora «reprogramame», «reprogramámela» y «reprogramá» llegan como pedido de agenda, con `proponer_mover_reunion`; «el programa» sigue siendo el sustantivo.',
      '**Cómo se prueba:** pedirle a MaKo en el grupo «reprogramame la reunión de mañana a las 10 para el jueves a las 12»: tiene que proponer moverla y esperar el «sí».',
    ],
    commits: [
      { sha: '618c79c4', msg: 'MaKo en WhatsApp: «reprogramame la reunión…» llega con la herramienta de mover (ws13, lo encontró el vigía)', lineas: 24, archivos: 2 },
    ],
    archivos: [
      'lib/mako-intencion.ts — VERBO_AGENDAR con `(re)programa` + pronombre y «reprograma» suelto',
      'tests/mako-en-whatsapp-pablo.test.ts — el literal del grupo; 3 roturas, 1 fallo cada una',
    ],
  },
  {
    fecha: '17 oct', hora: '09:45', chat: 'MaKo en WhatsApp', sesion: 'local_d3ed9496-3ca1-4037-abc2-a59ce57d3f9d', cuenta: 'claude4',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Hecho: cuando algo de MaKo falla en el grupo de WhatsApp, se le ofrece un ticket al equipo',
    revisar: '/tickets',
    puntos: [
      'Con la Ticketera: el doer le pasa al ticket QUIÉN escribió (`whatsapp:+<teléfono>`; un `@lid` no es un teléfono, ahí va el nombre) y el contexto del turno, con el error que registró el código. Si una herramienta de MaKo falló y el modelo no lo ofreció, lo ofrece el código, en una línea que pide el «sí».',
      '⚠️ **Todo lote de mensajes perdía quién escribió**: los dos mensajes que arma el doer al juntar mensajes no copiaban `participant`.',
      '**Cómo se prueba:** cuando una herramienta falle en un grupo, MaKo pregunta «¿Se lo aviso al equipo de MaKo…?»; con el «sí», el ticket aparece en /tickets. Martín pidió que se registre SOLO, sin preguntar: cambia cuando el `registrarError` de la Ticketera esté en main.',
    ],
    commits: [
      { sha: 'f00d8436', msg: 'MaKo en WhatsApp: levantar un ticket desde el grupo (quién escribe, el contexto, y lo propone el código si algo falló)', lineas: 147, archivos: 6 },
    ],
    archivos: [
      'lib/doer-ticket.ts — `actorDeWhatsApp` y la línea que ofrece el ticket',
      'lib/mako-doer-in.ts — `ctx.actor`, `ctx.contextoTicket`, `errorParaTicket` en el runTool y el ticket que propone el código',
      'tests/mako-en-whatsapp-pablo.test.ts — 13 roturas, todas con su fallo',
    ],
  },
  {
    fecha: '17 oct', hora: '09:36', chat: 'Cerebro', sesion: 'local_797d5445-2365-464d-ae3d-1d71aa7baa8c', cuenta: 'claude4',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Al arreglar algo de un cliente, avisarle en su grupo, firmado por el Desarrollador',
    pedido: 'Sería bueno que al terminar de solucionar algo que detectaste de un cliente, ya sea de Joan en este caso, le envíes un mensaje al grupo de MaKo diciendo que se solucionó eso. Con una aclaración de que sos el "Desarrollador". Y también lo mismo que corrés en MaKo en WhatsApp detectando errores, córrelo en toda la app (…). Y todo lo solucionás automáticamente.',
    puntos: [
      'Firmado desde el Ops Center y relayado por el Cerebro. La segunda mitad (detectar errores en toda la app) la tomó la Ticketera. A las 10:09 agregó: «No necesitas mi aprobacion, manda el mensaje tranquilamente al grupo».',
    ],
  },
  {
    fecha: '17 oct', hora: '10:02', chat: 'MaKo en WhatsApp', sesion: 'local_d3ed9496-3ca1-4037-abc2-a59ce57d3f9d', cuenta: 'claude4',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Hecho: el aviso «ya quedó arreglado», firmado por el Desarrollador, al grupo de MaKo de un cliente',
    revisar: '/second-brain?ws=13',
    puntos: [
      '`scripts/avisar-arreglo-al-grupo.mts` (los jefes) y `avisarArregloAlGrupo` (la Ticketera, desde su cron): firma «👨‍💻 Desarrollador de MaKo», rechaza promesas y groserías, el ws1 sólo a propósito, tope de 3 por negocio en 24 h, un aviso por arreglo (reserva atómica antes de mandar, que se suelta si no salió) y anota el eco para que MaKo no se conteste a sí mismo.',
      '⚠️ **«Está en producción» no se podía saber con lo que había**: no hay endpoint de versión y el `GITHUB_TOKEN` de la plataforma no ve el repo de hola-mako. Lo que anda es el CLI de Vercel por commit (`vercel ls --prod --meta githubCommitSha=<sha>`): el script exige el commit en main y un despliegue de producción Ready que lo contenga.',
      '**No es una operación de la API, a propósito**: el modelo o una automatización de un cliente podrían firmar como el equipo.',
      '**Cómo se prueba:** el primer aviso, el de «reprogramar» al grupo de Código Inmobiliario, espera que Martín apruebe el permiso del envío (el clasificador de Claude Code lo bloqueó dos veces).',
    ],
    commits: [
      { sha: '50a24c25', msg: 'El aviso «ya quedó arreglado», firmado por el Desarrollador, al grupo de MaKo de un cliente', lineas: 417, archivos: 7 },
      { sha: '18c9b1eb', msg: 'Aviso de arreglo: no necesita el OK de Martín (lo dijo el 17/10 10:09), y el script se corre con react-server', lineas: 21, archivos: 4 },
    ],
    archivos: [
      'lib/aviso-arreglo-reglas.ts — firma, texto, ws1, clave y tope (puro)',
      'lib/aviso-arreglo.ts — reserva, envío por la línea de MaKo, registro y anti-eco',
      'scripts/avisar-arreglo-al-grupo.mts — prueba la producción (git + Vercel); sin --enviar no manda',
      'tests/aviso-arreglo.test.ts — 6 tests, 11 roturas',
    ],
  },
  {
    fecha: '20 oct', hora: '17:42', chat: 'MaKo Alert', sesion: 'local_d3ed9496-3ca1-4037-abc2-a59ce57d3f9d', cuenta: 'claude4',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Hecho: «necesito que… lo pases a descalificados» es un pedido del CRM (ws13), ya en producción',
    revisar: '/second-brain?ws=13',
    puntos: [
      'MaKo Alert vio en el ws13 (19/10 13:44 UTC) «necesito que busques… a Joan… y que lo agarres y lo pases a la sección descalificados» → MaKo contestó **«no tengo acceso a listar los leads de tu CRM ni a moverlos»**. El lead no se movió.',
      '⚠️ **El diagnóstico obvio (un permiso o una herramienta que faltan) era el equivocado**: `proponer_cambio_etapa` existe. `esPedidoSobreLead` sólo leía imperativos («pasalo», «movelo»); con un modal + subjuntivo la frase caía a `capturar` dudosa con las tres herramientas del plan y NINGUNA de CRM, y Gemini flash-lite dedujo que no se podía. Ningún paso da error.',
      'Ahora `MODAL_CRM` lo toma: la 2ª persona del subjuntivo (-s: pases, muevas), nunca la 3ª («necesito que el closer marque…»), nunca «que me pases el lead» (es un «dame») y modal y verbo en la MISMA oración. «descalificados» no estaba entre las palabras que sólo viven en el CRM.',
      '**Sin hacer:** la pregunta con un modal («¿podés pasar a Joan a descalificados?») sigue siendo `consultar` y no trae las que escriben. Y no se probó el pedido de punta a punta en el grupo: el próximo pedido real lo dirá, y el vigía lo ve.',
      'El aviso «ya quedó arreglado» salió al grupo del ws13 firmado por el Desarrollador, con el despliegue de producción Ready de 0570b4d8b como prueba.',
    ],
    commits: [
      { sha: '4b0da1e0', msg: 'MaKo Alert: «necesito que… lo pases a descalificados» es un pedido de CRM, no un material para guardar', lineas: 51, archivos: 3 },
    ],
    archivos: [
      'lib/mako-intencion.ts — `MODAL_CRM`, «descalificad[oa]s» en OBJETO_CRM, `marques` como tipo calificado',
      'tests/crm-pedidos-whatsapp.test.ts — la frase literal del ws13 y los casos vecinos, 8 roturas con su fallo',
      'docs/hallazgos-comunicacion.md — la entrada «No puedo», «déjame ver»…, caso del ws13',
    ],
  },
  {
    fecha: '20 oct', hora: '19:10', chat: 'MaKo Alert', sesion: 'local_d3ed9496-3ca1-4037-abc2-a59ce57d3f9d', cuenta: 'claude4',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Ops Center es lo principal de MaKo: que se pueda hacer todo desde ahí',
    pedido: 'comienza a implementar directamente toda mi idea de que Ops Center sea lo principal en MaKo... quiero que en Ops Center se pueda hacer todo, editar videos, crear webs, etc...',
    puntos: [
      'Llegó por el Cerebro con el mapa de docs/ops-center-principal.md (510 acciones en 18 áreas, plan por olas). A este chat le toca la pieza 1.2: el clasificador del canal app, por tandas, con las frases de cada chat de área.',
    ],
  },
  {
    fecha: '20 oct', hora: '20:50', chat: 'MaKo Alert', sesion: 'local_d3ed9496-3ca1-4037-abc2-a59ce57d3f9d', cuenta: 'claude4',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Hecho: Ops Center 1.2, tanda 1 — el chat de la app propone con tarjeta en vez de anotar (CRM 41→91 de 91, núcleo 23→40 de 40)',
    revisar: '/admin/operaciones',
    puntos: [
      '⚠️ **El freno no eran las operaciones: era el clasificador.** El turno de la APP usaba el del grupo de WhatsApp, que ante la duda anota el pedido como idea y le saca a MaKo la herramienta de escribir. Medido con el turno real sobre las frases de los mapas: CRM 41 de 91, Automations y Clients 17 de 48, núcleo 23 de 40. Ahora: 91, 44 (las otras 4 son operaciones sólo http) y 40.',
      '**D1 = A, por defecto:** en la app, sin señal clara se actúa —se arma la tarjeta y nada se hace sin el toque—. WhatsApp sigue anotando (un test lo fija). Si Martín elige otra (B: preguntar «¿lo hago o lo anoto?»), es una rama (`deLaApp` en lib/mako-intencion.ts).',
      '`pideHacerAlApp` (un verbo de hacer al arranque, en tuteo y voseo, con pronombre pegado y como pedido indirecto), las familias de pedidos (de qué área es la operación y con qué palabras de su NOMBRE entra al presupuesto) y la búsqueda en TODO el registro cuando el texto no nombra un área.',
      '⚠️ **Dos trampas que no dan error:** un veredicto dudoso no suma las áreas del texto (`herramientasDelTurno` las suma solo con `!v.dudosa`), y la relevancia son raíces de 5 letras: un verbo suelto en la relevancia de una familia saca operaciones del presupuesto (medido: `editar_etiqueta` afuera, `cobranza_lead` adentro).',
      '**Sin hacer:** las tandas de Plan, Calendario y Dashboard, Pagos, Offer y Second Brain, video e imagen, Web y Ads (Meta después de la 1.4); abrir a la app las 4 operaciones de curso y comunidad que hoy son sólo http (Clients); confirmar D1 con Martín.',
    ],
    archivos: [
      'lib/mako-intencion-app.ts — `pideHacerAlApp` y la tabla de familias (puro)',
      'lib/mako-intencion.ts — `canal`, `buscaEnTodo`, `NOMBRADO`, la regla 6-quater y el default de la app',
      'lib/doer-herramientas.ts — la búsqueda en todo el registro (áreas del texto hasta el 60% del presupuesto)',
      'lib/mako-turno-app.ts — `canal: \'app\'`',
      'tests/ops-center-clasificador-app.test.ts — 175 frases medidas, 12 tests, 29 roturas con su fallo',
    ],
  },
  {
    fecha: '20 oct', hora: '22:05', chat: 'MaKo Alert', sesion: 'local_d3ed9496-3ca1-4037-abc2-a59ce57d3f9d', cuenta: 'claude4',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Hecho: Ops Center 1.2, tandas 2 y 3 — Plan, Calendario, Dashboard, video, imagen y creaciones llegan a su operación por la app',
    revisar: '/admin/operaciones',
    puntos: [
      'Con la maquinaria de la tanda 1 ya puesta, las frases nuestras de cada área (tuteo y voseo) llegaban: Plan 28 de 30, Calendario 5 de 8, Dashboard 26 de 28, video 35 de 37, imagen y creaciones 8 de 10. Ahora 30, 8, 28, 37 y 10 de ellas.',
      '⚠️ **Un detector de otra cosa se llevaba el pedido** —«quitá el gráfico de **leads** de la hoja» era un pedido sobre un lead, «agenda un reel» una reunión, «publicá mi **landing** en la galería de la comunidad» una landing, «dale una estrella» una confirmación—. Una familia de pedidos puede ganarle a un detector (`ganaALaAgenda`, `ganaAlLead`, `ganaALaLanding`) y su relevancia lleva sólo el nombre de la operación.',
      '**Sin hacer:** Pagos y cuenta, Offer, Copywriting y Second Brain, Web Generator y Ads (los verbos de Meta, después de la 1.4); las 4 operaciones de curso y comunidad que hoy son sólo http (Clients).',
    ],
    archivos: [
      'lib/mako-intencion-app.ts — las filas nuevas de FAMILIAS y las banderas que le ganan a un detector',
      'lib/mako-intencion.ts — `fam?.ganaAlLead`, `fam?.ganaALaLanding` y `ganaALaAgenda` en los detectores',
      'tests/ops-center-clasificador-app.test.ts — 288 frases, 17 tests, 38 roturas con su fallo',
    ],
  },
  {
    fecha: '20 oct', hora: '22:50', chat: 'MaKo Alert', sesion: 'local_d3ed9496-3ca1-4037-abc2-a59ce57d3f9d', cuenta: 'claude4',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Hecho: Ops Center 1.2, tanda 4 — Pagos y cuenta (cobros, equipo, reportes y avisos) llegan a su operación por la app',
    revisar: '/admin/operaciones',
    puntos: [
      'Misma medición: cobros 21 de 22 y equipo y cuenta 23 de 28 con la maquinaria de las tandas anteriores; ahora 22 de 22 y 26 de 26. Cerraron «dale de baja a Juan» (dale es una confirmación), «cambiale el rol a Pedro a closer» (closer es del CRM: el detector de leads se lo llevaba) y «renombrá este chat a Reunión semanal» (la agenda).',
      '⚠️ **Una operación que no es del admin de un cliente no es una falta del clasificador:** `exigir_2fa_desde` tiene gating de PLATAFORMA (sólo el super admin) y no llega a un admin; sus dos frases quedaron fuera de la batería.',
      '**Sin hacer:** Offer, Copywriting y Second Brain, Web Generator y Ads (los verbos de Meta, después de la 1.4); las 4 operaciones de curso y comunidad que hoy son sólo http (Clients).',
    ],
    archivos: [
      'lib/mako-intencion-app.ts — dar-de-baja, rol-equipo y renombrar-chat en FAMILIAS',
      'tests/ops-center-clasificador-app.test.ts — 336 frases, 19 tests, 43 roturas con su fallo',
    ],
  },
  {
    fecha: '20 oct', hora: '23:40', chat: 'MaKo Alert', sesion: 'local_d3ed9496-3ca1-4037-abc2-a59ce57d3f9d', cuenta: 'claude4',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Hecho: Ops Center 1.2, tandas 5 a 7 — Offer, Copywriting, Second Brain, experimentos, Web Generator y Meta Ads llegan a su operación por la app',
    revisar: '/admin/operaciones',
    puntos: [
      'Misma medición, tuteo y voseo: Offer, Copywriting y Second Brain 24 de 26 y 6 de 8 → 26 y 8; experimentos 10 de 10; Web Generator 35 de 39 → 39; **Meta Ads 30 de 30 sin una fila nueva** (los mapas medían Meta con tuteo en 0 de 18: lo arreglaron el verbo al arranque y la búsqueda en todo el registro, no un detector de Meta).',
      '⚠️ **El detector de landing dejaba la operación concreta afuera del presupuesto:** devolvía sólo `landings creadas` como relevancia y «mové la sección de precios arriba» o «ponele el link del VSL» no entraban. Ahora suma las palabras de la familia del pedido. Y `etapa` en «guardá el diagnóstico de fase: etapa de validación» lo leía el detector de leads.',
      '**Sin hacer:** completar `esPedidoDeLanding` (las frases llegan por las familias y la búsqueda, no por ese detector); la batería unificada de los 8 mapas (1.1, Ops Center 3) con las frases de cada chat de área; confirmar D1 con Martín; las 4 operaciones de curso y comunidad que hoy son sólo http (Clients).',
    ],
    archivos: [
      'lib/mako-intencion-app.ts — las filas de las tandas 5 y 6 en FAMILIAS',
      'lib/mako-intencion.ts — el detector de landing suma las palabras de la familia a su relevancia',
      'tests/ops-center-clasificador-app.test.ts — 449 frases, 24 tests, 52 roturas con su fallo',
    ],
  },
  {
    fecha: '20 oct', hora: '23:05', chat: 'MaKo Alert', sesion: 'local_d3ed9496-3ca1-4037-abc2-a59ce57d3f9d', cuenta: 'claude4',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Hecho: los arreglos de la revisión adversarial del clasificador de la app (WhatsApp, borrador del plan, irreversibles, lecturas del id)',
    revisar: '/admin/operaciones',
    puntos: [
      '⚠️ **WhatsApp SÍ cambiaba** y el test que decía lo contrario fijaba un solo caso: `NOMBRADO` corría en los dos canales y «cancela la llamada pendiente con Juan» dejaba de ser agenda (con una pendiente vigente caía en `confirmar`, con `cancelar_accion`, que corre sin tarjeta). Ahora sólo en la app y con el determinante delante. Medido comparando antes y después con las funciones reales: 4.242 frases × 4 contextos, 0 cambian contra origin/main.',
      '**Una adivinanza no crea un borrador del plan** (el bug del 25/08 volvía por la app): el default lleva `adivina` y sale `proponer_tareas_plan` y `cancelar_accion`. Los acuses («bueno», «buenas tardes») son charla.',
      '**Buscar en todo el registro ya no trae escrituras de otra cosa** («borrá la nota» → `borrar_audio`): sólo las áreas que el texto nombra pueden traer una destructiva o una lectura que cuesta; las otras entran por una raíz al principio de una palabra, sin palabras vacías. Por eso hubo que nombrar las áreas en las familias. Y una acción viaja con la lectura que le da el id (28 no la traían).',
      '**Sin hacer:** el costo de D1 = A (un turno de la app que actúa carga las 20 herramientas de siempre: ~14.400 caracteres para un mensaje sin señal, antes 763); completar `esPedidoDeLanding`; confirmar D1 con Martín.',
    ],
    archivos: [
      'lib/relevancia-app.ts — las pasadas del registro para la app, con sus frenos (nuevo)',
      'lib/doer-herramientas.ts — `adivina` en toolsParaIntencion y la llamada a registroParaLaApp',
      'lib/mako-intencion.ts — NOMBRADO sólo en la app, `adivina`, los acuses y lo de la app en todos los retornos',
      'lib/mako-intencion-app.ts — las formas homógrafas, `sinVerboAlArranque` y las palabras de área',
      'lib/api-mako/registro.ts — `donde` y `silencioso` en toolsDelRegistro (aditivos)',
      'tests/ops-center-clasificador-app.test.ts — 513 frases, 37 tests, 85 roturas con su fallo (incluye las 64 del chat de Video / AI Avatar, 64/64)',
    ],
  },
  {
    fecha: '21 oct', hora: '01:40', chat: 'MaKo Alert', sesion: 'local_d3ed9496-3ca1-4037-abc2-a59ce57d3f9d', cuenta: 'claude4',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Hecho: la segunda revisión del clasificador de la app — la red es la tarjeta, no la regla (11 errores medidos, arreglados)',
    revisar: '/admin/operaciones',
    puntos: [
      '⚠️ **Otra ronda de reglas habría dejado otros 11:** cada regla de la primera evitaba una cosa y dejaba afuera, o metía, otra (las filas de área abrían TODAS las destructivas del área: «eliminá las muletillas» traía `reiniciar_personalidad`; `reversible:false` frenaba «invitá a Ana»; «borrador» contiene «borra»). Se cambió la red, no las reglas.',
      '**En la app nada que cambie algo corre sin una tarjeta:** `cancelar_accion` (la única operación del registro que cambiaba algo sin tarjeta) ya no viaja; cancelar es el botón de la tarjeta. Un test recorre el registro entero (741 operaciones en la vista de un admin) y frena un control en el chat.',
      '**Lo que quita algo entra por la COSA que el pedido nombra, no por el área:** el pedido tiene que pedir quitar y nombrar el sustantivo de la operación (o un sinónimo); si no, no llega ninguna parecida y MaKo pregunta cuál. Las lecturas que dan el id llegan en todo turno de la app.',
      '**Medido por SHA, un proceso por árbol** (`scripts/medir-turnos-por-sha.mts`): WhatsApp 582.996 turnos, 0 cambian contra origin/main; la app 145.749 turnos con cada cambio explicado (D1 = A, acuses, controles, destructivas que no se pidieron).',
      '**Sin hacer:** «suspendé a Pedro» y «sacá a Juan de Bienvenida» ahora preguntan cuál (no nombran la cosa); «meté a Juan en Prospección» no llega; D1 sigue pendiente de Martín; el costo de las 20 herramientas de siempre en cada turno que actúa.',
    ],
    archivos: [
      'lib/relevancia-app.ts — la puerta de las destructivas (`nombraLaCosa`), `lecturasDeLasAcciones`, las pasadas 75% / 25%',
      'lib/mako-turno-app-reglas.ts — `cancelar_accion` fuera del chat, las lecturas del id en todo turno y la instrucción de preguntar cuál',
      'lib/mako-intencion.ts — NOMBRADO detrás de un sustantivo, familia sola = adivinanza, el acuse después de una pregunta',
      'lib/mako-intencion-app.ts — `pideQuitar`, las homógrafas con número / en / como / para, las familias de tarea',
      'scripts/medir-turnos-por-sha.mts y scripts/volcar-turnos.mts — el arnés por SHA',
      'tests/ops-center-clasificador-app.test.ts — la red recorre el registro entero y las 11 frases de la nota, cada una con su rotura',
    ],
  },
  {
    fecha: '21 oct', hora: '04:30', chat: 'MaKo Alert', sesion: 'local_d3ed9496-3ca1-4037-abc2-a59ce57d3f9d', cuenta: 'claude4',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Hecho: lo que le llega a un tercero se confirma por WhatsApp con un «sí» y nada más (el pedido del Cerebro al revisar la 2.1 de CRM)',
    revisar: '/admin/operaciones',
    puntos: [
      '⚠️ **La regex `CONFIRMACION` arranca con `^` y no cierra:** «ok, esperá que lo reviso», «perfecto, después lo veo» o «sí pero cambiale la hora» llegaban como confirmación de la pendiente. Para lo interno cuesta poco; para un email, una invitación o un link de pago a otra persona, no se deshace.',
      '**La red es una puerta de código, no más palabras:** las doce acciones de chat que le llegan a un tercero llevan `aTerceros: true`, y `confirmarPendiente` (y el camino viejo de `confirmar_accion`) no las ejecuta por WhatsApp si el mensaje no es una confirmación pura (lib/confirmacion-pura.ts); la pendiente sigue viva y MaKo repregunta mostrando qué va a salir. Un test frena la acción nueva que dice que le llega a alguien y no está marcada.',
      '**Medido (60 días, producción, por SHA):** hoy no pasa en la práctica: 8 confirmaciones por el «sí» del grupo, las 8 de agendar un evento y las 8 con un «Si» solo. Pero de 22 mensajes reales que llegan a `confirmar`, 13 no son una confirmación («Si 18 de noviembre», «Ok, decime que reuniónes tengo hoy»). WhatsApp: 593.784 turnos, 0 cambian.',
      '**Sin hacer:** las acciones nuevas de CRM 2.1 (`enviar_borrador_whatsapp`, `contestar_dm`, `contestar_email_chat`) tienen que llevar `aTerceros: true` al entrar a main; las de efecto indirecto (una etiqueta que dispara una automatización) no se marcan.',
    ],
    archivos: [
      'lib/confirmacion-pura.ts — `confirmacionPura` y la puerta `rechazoSiNoEsConfirmacionPura` (puro)',
      'lib/api-mako/acciones.ts y lib/mako-doer-acciones.ts — la puerta antes de reclamar la pendiente',
      'lib/api-mako/tipos.ts y areas/*.def.ts — `aTerceros` en las doce acciones',
      'tests/confirmacion-terceros.test.ts — 8 tests, 10 roturas con su fallo',
    ],
  },
  {
    fecha: '24 oct', hora: '21:40', chat: 'Cerebro', sesion: 'local_3f1a66d3-690f-4ebc-bd98-7dcf1cf14bb8', cuenta: 'claude5',
    actor: 'claude', tipo: 'investigacion',
    titulo: 'Medido: Vercel SÍ encuentra el despliegue por commit, con el sha ENTERO; el aviso «ya quedó arreglado» va con el arreglo del Ops Center (b2aa04e1c)',
    puntos: [
      '⚠️ **El diagnóstico obvio era el equivocado, dos veces:** la cosecha del 24/10 decía que el despliegue «no guarda el commit» y que la guarda no podía dar verde nunca. Medido el 24/10 a las 21:00: `vercel ls --environment production --meta githubCommitSha=<sha de 40>` devuelve el despliegue de producción en Ready; con el sha corto, «No deployments found».',
      '**Se descartó un arreglo propio** que pedía una frase servida por una página pública: andaba (verde contra producción, «no» con motivo en tres casos), pero no cubría los arreglos que sólo se ven con sesión, que son casi todos. El del Ops Center de claude1 (`b2aa04e1c`, que estaba sin subir) pregunta qué despliegue sirve hola-mako.com y de qué commit es: cubre todo.',
      '**Al probarlo se vio:** en Git Bash un argumento que empieza con «/» llega como carpeta de Windows (`/crm` → `C:/Program Files/Git/crm`).',
    ],
    archivos: [
      'scripts/avisar-arreglo-al-grupo.mts y lib/vercel-salida.ts — la guarda (b2aa04e1c, del Ops Center)',
      'docs/hallazgos-infra.md — la cosecha corregida',
    ],
  },
  {
    fecha: '25 oct', hora: '13:55', chat: 'MaKo en WhatsApp: conexiones', sesion: 'local_68bd90bc-b11c-49c9-8642-f69aca1f3ce7', cuenta: 'claude5',
    actor: 'claude', tipo: 'correccion',
    titulo: 'El cartel del grupo cuando falta una conexión: sin Gemini, con la computadora no miente, un link por cada cosa y el texto guardado',
    puntos: [
      'Martín, 25/10, por Florencia (ws21): «le sigue diciendo que debe conectar su IA de Gemini, cuando dijimos que todo eso se hace con la app de escritorio de MaKo y conectado a su claude o GPT». Tanda 1 de docs/conexiones-y-ayuda.md.',
      '⚠️ **El diagnóstico obvio —«que instale MaKo Desktop»— era el equivocado:** el grupo no pasa por la computadora (D6a), y con la computadora conectada y sin clave el cartel decía «tu negocio todavía no tiene su IA conectada». El doer tiraba `conPc` en el texto y en el audio. Ahora: «tu Claude está en tu computadora y te contesta en la app», con el link del chat y el de su GPT.',
      '**En el grupo se ofrece su GPT por clave, nunca Gemini y tampoco su Claude:** su Claude entra sólo en turnos sin herramientas (WA1) y no escucha. `ia_lenta` y `sin_respaldo` sin «son gratis» ni «otro Gemini»; con su GPT como la que falló, no se le ofrece nada.',
      '**Un link por cada cosa que falta:** su GPT, MaKo Desktop y, si pregunta por sus llamadas, Fathom (`conexionesDelPedido`). Si Fathom no se pudo leer, no se dice que falta.',
      '⚠️ **`recordUsage` cortaba el motivo a 200:** el texto del cartel no quedaba en ningún lado. Ahora va entero en la fila `cartel-ia` que lee el vigía, y el cartel del audio deja la suya.',
    ],
    archivos: [
      'lib/fallo-ia-texto.ts — los textos, `enlaceA`, `conexionesDelPedido`, `motivoDelCartel` (puro)',
      'lib/mako-doer-in.ts — `conPc` en los dos caminos, lo que falta y la fila del vigía',
      'lib/anthropic-usage.ts — el motivo de `cartel-ia` hasta 1500',
      'tests/doer-cartel-sin-ia.test.ts — 9 tests, 11 roturas con su fallo; y los que fijaban Gemini, a la regla nueva',
    ],
  },
  {
    fecha: '25 oct', hora: '16:20', chat: 'MaKo en WhatsApp: conexiones', sesion: 'local_68bd90bc-b11c-49c9-8642-f69aca1f3ce7', cuenta: 'claude5',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Lo que MaKo sabe de cómo conectar cada cosa sale del catálogo único: el prompt, las capacidades, los DEEP_LINKS, la intención y los carteles',
    puntos: [
      'Tanda 3 de docs/conexiones-y-ayuda.md. El prompt tenía tres links a mano (meta, anthropic, landing) y le prohibía a MaKo dar otros: ahora da los de su GPT, su computadora, Fathom, Zernio y el resto que más se pide, y para lo demás `como_conectar`.',
      '**La intención** trae las herramientas de conectar con «conectar», «mi Claude», «la app de escritorio», Zernio o una clave de IA, y ya no nombra el inbox retirado. ⚠️ El `\\b` de JavaScript es ASCII: tras «conecté» no hay borde.',
      '**El contrato de los links** (`?abrir=<key>`, `?abrir=ia`, `/perfil/ia?computadora=1`, `/chats?conectar=whatsapp`) quedó en AGENTS.md, y una guarda barre que ningún texto mande a «/integraciones» a secas.',
    ],
    archivos: [
      'lib/conexiones-catalogo.ts — `EN_EL_PROMPT` y `conexionesParaElPrompt`',
      'lib/hechos-mako.ts, lib/mako-capacidades.ts, lib/mako-intencion.ts, lib/fallo-ia-texto.ts — del catálogo',
      'tests/conexiones-un-solo-lugar.test.ts — 5 tests, 9 roturas con su fallo',
    ],
  },
  {
    fecha: '25 oct', hora: '17:30', chat: 'MaKo en WhatsApp: conexiones', sesion: 'local_68bd90bc-b11c-49c9-8642-f69aca1f3ce7', cuenta: 'claude5',
    actor: 'claude', tipo: 'implementacion',
    titulo: '«¿Quieres que te ayude a conectarlo?» y «¿Levanto un ticket?» por WhatsApp, atendidos por el código y sin IA',
    puntos: [
      'Martín, 25/10: «que le ofrezca ayuda, que le de el link y que le pregunte si quiere que le ayude con eso» y «que le proponga levantar un ticket... tiene que ser fácil». Tanda 5 de docs/conexiones-y-ayuda.md.',
      '⚠️ **Sin su IA, ningún «sí» confirmaba nada** (la confirmación pasa por el modelo): la oferta, la guía paso a paso y el ticket los atiende el código antes de la IA, con el estado 30 minutos en app_settings.',
      '⚠️ **Proponer y confirmar el ticket con el mismo «sí» rebotaba** (`confirmarPendiente` no confirma lo del mismo turno): se propone al ofrecerlo y el «sí» siguiente lo confirma.',
      '**El «listo» prueba la conexión de verdad** (la clave contra el proveedor, la computadora en línea); si no anda, el link de nuevo y el ticket con el motivo.',
    ],
    archivos: [
      'lib/doer-ayuda.ts — el estado, las respuestas, los pasos y los textos (puro)',
      'lib/conexion-estado.ts — `conectadaSinProbar` y `conectadaProbando`',
      'lib/mako-doer-in.ts — `atenderAyuda`, `proponerTicket` y la oferta en los carteles',
      'tests/doer-ayuda.test.ts — 7 tests, 11 roturas con su fallo',
    ],
  },
  {
    fecha: '25 oct', hora: '18:40', chat: 'MaKo en WhatsApp: conexiones', sesion: 'local_68bd90bc-b11c-49c9-8642-f69aca1f3ce7', cuenta: 'claude5',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El grupo de MaKo del dueño contesta con su computadora, cuando escribe quien la conectó',
    puntos: [
      'Martín, 25/10: «dijimos que todo eso se hace con la app de escritorio de MaKo y conectado a su claude o GPT». Tanda 4 de docs/conexiones-y-ayuda.md, sobre la puerta de la computadora que hizo MaKo Desktop (`delGrupo`).',
      '⚠️ **«Como el turno del chat de la app» no encajaba:** el doer conserva su turno (pendientes, agenda, memoria) y sólo la llamada al modelo va a la PC, con sus mismas herramientas.',
      '**La identidad es el teléfono que manda WhatsApp**, probado en la puerta contra el perfil y contra quien conectó la PC; un lote de varias personas no va. Sin su número en el perfil, su computadora no contesta el grupo, y el cartel lo dice.',
      '**Leads, Automations, nutrición y crons siguen sin llegar a la PC** (D6a entera para todo eso). AGENTS.md, lib/conectar-ia-reglas.ts y docs/ia-del-cliente.md con la cita.',
    ],
    archivos: [
      'lib/mako-doer-in.ts — `pcDeQuienEscribe`, el turno a la PC y `loteDeVarios`',
      'lib/doer-ticket.ts — `telefonoDelParticipante`',
      'lib/fallo-ia-texto.ts — el cartel según qué pasó con SU computadora',
      'tests/ia-pc-nunca-a-leads.test.ts (7, 5 roturas) y tests/doer-cartel-sin-ia.test.ts (7, 3 roturas)',
    ],
  },
  {
    fecha: '26 oct', hora: '02:00', chat: 'MaKo en WhatsApp: conexiones', sesion: 'local_68bd90bc-b11c-49c9-8642-f69aca1f3ce7', cuenta: 'claude5',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'MaKo en WhatsApp sigue la conversación: un seguimiento sigue el pedido, y lo de antes vuelve como hecho',
    puntos: [
      '«No guarda contexto» no era la memoria: el modelo veía la charla, pero lo que podía hacer salía del último mensaje solo.',
      '«pausala», «publicá la del webinar» o «mandales a esos 5» llegaban sin con qué hacerlo; ahora siguen el pedido que MaKo ya contestó.',
      'Lo de más de 14 horas vuelve como hechos con su fecha, y también lo que MaKo propuso en el grupo y cómo terminó.',
      'Lo que mostraron sus herramientas (los ids) llega al turno siguiente: «descartá esa» sabe cuál es.',
      'La lectura de producción quedó frenada por un permiso: el script para medirla queda en el repo.',
    ],
    archivos: [
      'lib/doer-hilo.ts — el seguimiento y lo que ya se habló',
      'lib/mako-doer-in.ts — el turno con el hilo y los hechos en su system',
      'scripts/medir-hilo-whatsapp.mts — la medición, de sólo lectura',
      'tests/doer-hilo.test.ts — 34 roturas, todas caen',
    ],
  },
  {
    fecha: '28 oct', hora: '10:50', chat: 'MaKo en WhatsApp: conexiones, ayuda y tickets', sesion: 'local_216acd59-4fee-4349-be06-08ebffa59932', cuenta: 'claude4',
    actor: 'claude', tipo: 'correccion',
    titulo: 'Las notas de voz del grupo se escuchan con Groq, nunca con Gemini, y la que no se escucha lo dice',
    pedido: 'Martín, por Leandro: «Y falló Gemini cuando te pedí que deprequemos Gemini por los grupos de WhatsApp...».',
    puntos: [
      'Leandro mandó dos audios y MaKo no los escuchó: Gemini cortó por tiempo. Al primero le contestó sólo el texto de al lado, con un consejo inventado; al segundo, 👍 y nada más.',
      '⚠️ **El aviso «no lo pude escuchar» ya existía**, pero sólo para el audio suelto: cuando llegaban varios mensajes juntos, el audio se tiraba sin decir nada.',
      'Ahora la nota de voz de un grupo va primero al Groq de MaKo y nunca a Gemini. La que no se escucha, MaKo la pide por escrito y deja ticket.',
      'Un pedido de una función («como lo hace ManyChat») ya no se contesta con un consejo: MaKo dice en qué anda su ticket, o abre uno.',
      '**Cómo se prueba:** mandar una nota de voz al grupo de MaKo de un negocio; y otra junto con un texto. Las dos se contestan.',
    ],
    commits: [
      { sha: '8caf3315d', msg: 'MaKo en WhatsApp: la nota de voz del grupo va a Groq y nunca a Gemini, la que no se escucha lo dice con su ticket, y un pedido de funcionalidad no se contesta con un consejo', lineas: 298, archivos: 7 },
    ],
    archivos: [
      'lib/ai-cheap.ts — `notaDeVozDelGrupo`: el Groq de MaKo primero, Gemini nunca',
      'lib/mako-doer-in.ts — `avisarAudioSinEscuchar`, una sola para el audio suelto y los lotes',
      'lib/doer-falla-frases.ts — `pideUnaFuncionalidad`',
      'tests/doer-falla.test.ts — el caso de Leandro, rojo-verde',
    ],
    tickets: [18],
  },
  {
    fecha: '29 oct', hora: '14:50', chat: 'MaKo en WhatsApp', sesion: 'local_cf058ed5-4fbb-41b8-b1f9-93030d11d1a6', cuenta: 'claude3',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'MaKo en el grupo sabe si le hacen una pregunta, le piden una acción o le reportan un problema, y delega lo que no hace sola',
    pedido: 'Martín: «Es una verdadera desgracia cómo está respondiendo MaKo en WhatsApp… Que sepa cuándo es un ticket, cuándo es una pregunta, o una acción dentro de MaKo».',
    puntos: [
      'La clase del mensaje la decide la IA (Haiku, el crédito de los grupos): pregunta, acción, ticket, debug, charla o «no es para MaKo». En 76 mensajes reales de 9 grupos acierta 75 (las reglas solas, 49).',
      'Un ticket no pasa por el modelo: lo abre el código y la respuesta es fija, con el número. Una charla es el 👍; lo que no es para MaKo, silencio.',
      'Una acción simple (una ficha, una etapa, una nota, una reunión, una tarea) la hace MaKo; cualquier otra se delega al Cerebro como «pedido delegado» y el «listo» vuelve al grupo.',
      'Una pregunta va sólo con lecturas, y un número que no vio no sale.',
      '**Cómo se prueba:** en el grupo de un negocio, «¿cuántos leads entraron hoy?», «agéndame una reunión con Juan el viernes» y «el botón de pagar no anda».',
    ],
    commits: [
      { sha: 'fd7b00a45', msg: 'MaKo en el grupo sabe cuándo es una pregunta, una acción, un ticket, un debug, una charla o no es para él', lineas: 3385, archivos: 8 },
      { sha: '4a15d0775', msg: 'MaKo en el grupo es un despachante: hace sola lo simple, delega lo demás al Cerebro y el DEBUG lo resuelve el código', lineas: 999, archivos: 27 },
      { sha: 'de5778615', msg: 'Despachante: los rojos de tests-afectados y el tipo del DEBUG que ya sale antes', lineas: 65, archivos: 5 },
      { sha: '6af2bb1e0', msg: 'Despachante: los rojos de las barredoras (cableado de la forma vieja, «acá», el reenvío con la pregunta del equipo viva)', lineas: 74, archivos: 15 },
      { sha: '200cf0582', msg: 'Despachante: las roturas D1–D12 cazadas, y la cosecha de la verificación', lineas: 23, archivos: 4 },
    ],
    archivos: [
      'lib/mako-intencion-ia.ts — la clase, con el banco de casos reales',
      'lib/despacho-grupo.ts — qué hace MaKo sola y qué delega; las respuestas fijas',
      'lib/mako-doer-in.ts — el despacho en el turno',
      'scripts/banco-clases.mts — el banco (tests/fixtures/banco-grupos-2910.json)',
      'tests/clase-del-grupo.test.ts — por la entrada real, 14 escenas',
    ],
  },
  {
    fecha: '29 oct', hora: '18:40', chat: 'MaKo en WhatsApp', sesion: 'local_cf058ed5-4fbb-41b8-b1f9-93030d11d1a6', cuenta: 'claude3',
    actor: 'claude', tipo: 'correccion',
    titulo: 'MaKo ya no te ofrece hacer lo que no puede, y si le preguntas por un arreglo te dice en qué quedó',
    puntos: [
      'Leandro preguntó «¿lo actualizaste en la documentación API?» y MaKo contestó «no tengo acceso… pídemelo otra vez y lo hago»: una promesa falsa, y un ticket de «no pude» por una pregunta.',
      '«Pídemelo otra vez y lo hago» ya no sale cuando la respuesta dice que MaKo no puede hacerlo.',
      'Ahora MaKo ve lo que salió en producción para cada pedido resuelto del negocio, y una pregunta por el estado de un arreglo se contesta con eso.',
      '**Cómo se prueba:** en el grupo de un negocio con un pedido resuelto, preguntar «¿eso ya quedó?».',
    ],
    archivos: [
      'lib/doer-salida.ts — `noLoPuedeHacer` y `SIN_HACER_SIN_PROMESA`',
      'lib/pedidos-del-negocio.ts — lo que salió en producción en el bloque de pedidos',
      'lib/tickets-cierre.ts — `hitosDesplegados`',
    ],
    tickets: [30],
  },
  {
    fecha: '29 oct', hora: '20:30', chat: 'MaKo en WhatsApp', sesion: 'local_cf058ed5-4fbb-41b8-b1f9-93030d11d1a6', cuenta: 'claude3',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Desde el grupo, MaKo replica tus landings y pausa tus campañas; el presupuesto y el WhatsApp a un lead se aprueban en la app',
    puntos: [
      'Lo que Martín mostró en la llamada con Thiago («desde el grupo, lo que quieras», «replicame esta landing») lo hace MaKo, no lo pasa al equipo: replicar y analizar una landing, pausar o prender una campaña o un anuncio.',
      'Cambiar un presupuesto (es plata) queda propuesto y se aprueba en /mako/revisar. Un WhatsApp a un lead queda propuesto y sale con un toque en la app: un «sí» en el grupo no lo manda.',
      'Si le pides varias cosas a la vez, hace las que puede y lo demás lo pasa al equipo con su número: no se pierde ninguna parte.',
      'Si nadie del equipo toma un pedido en 30 minutos, MaKo te avisa en el grupo.',
      '**Cómo se prueba:** en el grupo de un negocio, «replícame esta landing https://…», «pausa la campaña X» y «muéveme la reunión con Juan y mándale un WhatsApp».',
    ],
    archivos: [
      'lib/despacho-grupo.ts — qué hace MaKo directo, qué va por pantalla, el pedido compuesto y el aviso de los 30 minutos',
      'lib/confirmacion-pura.ts — `SE_APRUEBAN_EN_LA_APP`: el WhatsApp a un lead',
      'lib/mako-intencion-ia.ts — las `partes` de un pedido compuesto',
      'lib/tickets-cierre.ts + app/api/cron/tickets — `avisarDelegadosSinTomar`',
      'tests/clase-del-grupo.test.ts — por el turno real (el modelo pide la herramienta)',
    ],
  },
  {
    fecha: '29 oct', hora: '22:00', chat: 'MaKo en WhatsApp', sesion: 'local_cf058ed5-4fbb-41b8-b1f9-93030d11d1a6', cuenta: 'claude3',
    actor: 'claude', tipo: 'implementacion',
    titulo: '«Súbeme este anuncio»: MaKo toma el video o la imagen del grupo (o un Drive) y te deja el anuncio en pausa para aprobar',
    puntos: [
      'Mandas el video o la imagen al grupo (o el link de Drive) y MaKo deja propuesto el anuncio EN PAUSA en el conjunto que digas; lo apruebas en la app y sale por Zernio.',
      'Todavía apagado: lo prende la prueba de anuncios por Zernio, que hace Martín. Mientras, MaKo lo dice y no sube nada.',
      'Un video mandado al grupo ya no se pierde: antes MaKo no lo leía.',
      '**Cómo se prueba (con la prueba hecha):** mandar un video al grupo con «súbelo como anuncio en el conjunto X, que lleve a https://…».',
    ],
    archivos: [
      'lib/anuncio-desde-archivo.ts — el link de Drive, qué archivo sirve, la ruta en el bucket',
      'lib/api-mako/areas/ads.run.ts — `proponer_anuncio_desde_archivo`, detrás de ZERNIO_ANUNCIOS_PROBADO',
      'lib/zernio-ads-cuerpo.ts — el video por link (`video.url`)',
      'tests/anuncio-desde-archivo.test.ts y tests/clase-del-grupo.test.ts (10, por el turno real)',
    ],
  },
  {
    fecha: '30 oct', hora: '01:00', chat: 'MaKo en WhatsApp', sesion: 'local_cf058ed5-4fbb-41b8-b1f9-93030d11d1a6', cuenta: 'claude3',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'Desde el grupo, MaKo sólo te muestra lo tuyo, y lo que toca plata, envíos o borrados lo aprueba Martín',
    puntos: [
      'Lo que salió en producción para tus pedidos te lo cuenta sólo si es tuyo: un arreglo que también era de otro negocio no aparece en tu grupo.',
      'Un pedido que mueve plata (un presupuesto, un cobro, prender anuncios), manda o publica algo, o borra algo, pasa por Martín antes de hacerse, aunque tu negocio tenga la vía rápida. Lo mismo si lo pide alguien del grupo que no es admin de tu negocio en MaKo.',
      'Cuando el equipo termina un pedido tuyo, el «listo» dice lo que pediste y el link para verlo, sin notas del equipo.',
      '**Cómo se prueba:** en el grupo de un negocio con vía rápida, «súbele el presupuesto a la campaña X» queda esperando a Martín; «duplica la landing X», pedido por un admin del negocio, sale directo.',
    ],
    archivos: [
      'lib/tickets-reglas.ts — `hitosDelNegocio`, `delegadoQueDecideMartin`, `sinLoInterno`',
      'lib/mako-doer-in.ts — quién escribe (`participantAlt`), el DEBUG por persona, `diagnosticar_negocio` fuera del modelo',
      'tests/despacho-grupo.test.ts (13–15) y tests/clase-del-grupo.test.ts (11, por el turno real)',
    ],
  },
  {
    fecha: '30 oct', hora: '10:30', chat: 'MaKo en WhatsApp', sesion: 'local_cf058ed5-4fbb-41b8-b1f9-93030d11d1a6', cuenta: 'claude3',
    actor: 'claude', tipo: 'correccion',
    titulo: 'MaKo te dice la hora real de las reuniones de tus leads',
    tickets: [35],
    puntos: [
      'Cuando le pides a MaKo la fecha y el horario de la reunión de un lead, ahora te dice la hora que está agendada, en tu zona horaria. Antes te decía «a las 10:00» aunque fuera a otra hora.',
      'Si una reunión tiene el día pero no la hora, MaKo te dice el día y que no tiene la hora: no la inventa.',
      '**Cómo se prueba:** en el grupo, «pásame la fecha y horario de la reunión de <un lead agendado>»: tiene que decir la hora de su ficha.',
    ],
    archivos: [
      'lib/mako-ficha-lead.ts — `horasDeLasReuniones`: la hora de la R1 y la R2 en la zona del negocio',
      'lib/mako-tools.ts — `resumenLead` (buscar_leads y ficha_lead) la lleva',
      'tests/mako-ficha-lead.test.ts — con los datos reales del ticket',
    ],
  },
  {
    fecha: '3 nov', hora: '16:40', chat: 'Bot y avisos', sesion: 'local_0fabc2d4-f10f-4a2d-b0ef-70cec8e878a7', cuenta: 'claude5',
    actor: 'martin', tipo: 'prompt',
    titulo: 'Sale de los grupos: un bot que sólo contesta',
    pedido: 'conservar el chat de MaKo en WhatsApp con un bot ahí que responde automáticamente, pero no va a crear ni grupos de WhatsApp y no va a mandar ni mensajes a nadie... si un usuario lo quiere escribir porque entró a la landing y vio que había un botón de hablar por WhatsApp, le escribe, ahí MaKo le puede responder',
    puntos: ['Lo pidió después de que WhatsApp baneara la línea de MaKo. Los grupos siguen hasta que los avisos lleguen por la app.'],
  },
  {
    fecha: '3 nov', hora: '19:40', chat: 'Bot y avisos', sesion: 'local_0fabc2d4-f10f-4a2d-b0ef-70cec8e878a7', cuenta: 'claude5',
    actor: 'claude', tipo: 'implementacion',
    titulo: 'El bot 1 a 1 de MaKo, apagado hasta que tenga su línea',
    puntos: [
      'Nunca escribe primero: la puerta (lib/mako-salida.ts) no deja salir nada a quien no escribió en las últimas 24 horas.',
      'Quien no tiene cuenta habla con ventas, sin herramientas. Quien administra un negocio, con el mismo MaKo de su grupo. Una agencia elige el negocio una sola vez.',
      'Sólo habla de MaKo y del negocio de quien escribe, por la regla de IA de Meta.',
      '**Cómo se prueba:** hace falta una línea propia. Con `mako.bot.instancia`, `mako.bot.activo` = `si` y `mako.bot.solo` con tu número, escribile a esa línea: nadie más recibe nada.',
    ],
    archivos: [
      'lib/mako-salida.ts — la puerta · lib/mako-salida-drivers.ts — Evolution y la API oficial',
      'lib/mako-bot.ts y lib/mako-bot-reglas.ts — quién es y qué se hace con cada mensaje',
      'tests/mako-bot.test.ts, tests/mako-bot-reglas.test.ts',
    ],
  },
];
