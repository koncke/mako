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
];
