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
];
