# Hallazgos del Chatbot (/chatbot: el flujo con ramas)

Lo que hay que saber antes de tocar el lienzo de /chatbot, su motor, «Probar» o el conversor de
las secuencias de antes. El área es dónde vive el código:

- el modelo: `lib/flujo-grafo.ts` y `lib/flujo-legado.ts`;
- el motor: `lib/nutricion.ts`, `lib/nutricion-grafo-motor.ts` y los demás `lib/nutricion-*.ts`;
- el lienzo: `lib/flujo-conversacion.ts`, `lib/lienzo-grafo.ts`, `app/_components/Lienzo.tsx`,
  `app/chatbot/FlujoLienzo.tsx` y `app/chatbot/SecuenciaPerfil.tsx`;
- «Probar» y la página: `lib/simulador-grafo.ts`, `lib/prueba-paso.ts`, `app/chatbot/PanelProbar.tsx`,
  `app/chatbot/SimuladorWhatsApp.tsx`, `app/chatbot/ChatAgentApp.tsx` y
  `app/api/chat-agent/simulador/route.ts`;
- la biblioteca de archivos: `lib/setting-adjuntos.ts` y `lib/setting-adjuntos-reglas.ts`.

El composer de WhatsApp (`app/whatsapp/_shared/`), la biblioteca vista desde el bucket y las
etiquetas del teléfono están en [hallazgos-comunicacion.md](hallazgos-comunicacion.md); las
etiquetas del CRM, en [hallazgos-crm.md](hallazgos-crm.md). Lo de antes del rediseño (el modo
asistido, el recordatorio, la reagenda) sigue en hallazgos-comunicacion.md → «Las seis tarjetas
del Chatbot en paralelo». El diseño y el pedido literal de Martín (los doce puntos del
08/10/2026) están en [chatbot-flujo-ramas-diseno.md](chatbot-flujo-ramas-diseno.md).
**No es un changelog.**

*Origen: el rediseño del 08/10/2026, cuenta 2. Cinco partes en paralelo (corrida
`wf_8096a9d7-b3f`: **P** página y «Probar», **C** composer, **L** lienzo, **E** etiquetas, **M**
motor), una revisión adversarial (`wf_c1c0d3d3-ae3`: 43 hallazgos, 42 confirmados, 1 refutado) y
sus arreglos (`wf_92e4c306-856`). Entre corchetes, quién lo vio: la parte, o el id del hallazgo de
la revisión.*

## Lo que más muerde

- **Un flujo nunca pasa por `legadoAGrafo`, y tener ids no lo hace un flujo.** El conversor arma la
  salida recorriendo el array en fila: sobre un flujo con ramas las aplasta → [El modelo](#el-modelo).
- **La entrada es `raizSalida`, nunca `pasos[0]`, y «lo que sigue» sale de los puertos, nunca de
  `pasos.slice`.** Debajo, en el array, puede haber otra rama → [El motor](#el-motor).
- **«Otra cosa» cierra la CHARLA, no el estado.** Congelar en 'handoff' «como antes» deja la
  inscripción sin salida; no cerrar nada deja a MaKo contestando solo mientras le habla una persona
  → [El motor](#el-motor).
- **La LIMPIEZA de la estrategia no es inerte.** `logrado: 'ninguno'` cambiaba lo que MaKo le
  escribía al lead y lo dejaba sin post-agenda al reagendar → [El modelo](#el-modelo).
- **Lo que la pantalla afirma sale de la regla del motor.** La casilla «Revisar» pintaba «sale sola»
  y el motor dejaba un borrador → [El lienzo](#el-lienzo).
- **«A mi WhatsApp» le escribía al cliente**, y el arreglo obvio (`getPerfil`) devuelve al admin del
  cliente → [«Probar» y la página](#probar-y-la-página).
- **Un escritor que no sabe de ramas aplana un flujo SIN ERROR**: una lista es un flujo válido.
  `armarSecuenciasDeAudios` (onboarding) lo hacía en cada carga sobre #198/#212/#213 →
  [Escritores que no saben de ramas](#escritores-que-no-saben-de-ramas-aplanaban-un-flujo-sin-error-cosecha).

---

## El modelo

### «Volver al principio» dejaba la salida sin raíz: un salto no es un padre [P]

**Síntoma:** un flujo que termina en «Ir a» la PRIMERA tarjeta (el «volver al principio» de
ManyChat, con una espera en el medio) pasaba `validarGrafo` sin un error y su salida no arrancaba
nunca. Medido: `[m1 → esperar 1 día → ir_a m1]` daba `raiz = null` y `errores = []`, y «Probar»
mostraba «Sin tarjetas».

**Causa:** `raizSalida` salteaba todo nodo que fuera destino de un salto, y el destino era justo la
raíz. `validarGrafo` contaba los destinos de salto como alcanzables, así que no marcaba nada suelto.

**Regla:** la raíz se elige por PUERTOS: el primer nodo que ningún puerto apunta y que no es «Si
responde». Ser destino de un «Ir a» no lo descarta, y un salto tampoco salva a una tarjeta suelta:
a la que sólo se llega saltando es una segunda salida que nadie dibuja. Arreglado en la base
(`ebdb5003`).

**Vive en:** `lib/flujo-grafo.ts` (`raizSalida`, `validarGrafo`) · `tests/flujo-grafo.test.ts`

### Tener ids no es ser un flujo, y un flujo nunca pasa por `legadoAGrafo` [P, L, M]

**Síntoma:** tres partes lo vieron por separado. Un flujo con ramas que traía algo de antes encima
(un `delay_horas` que volvió a poner la API de MaKo, o la estrategia todavía sin limpiar) se habría
vuelto a convertir: el lienzo lo mostraba en una sola fila y «Probar» le sumaba un segundo «Si
responde» con los casos viejos.

**Causa:** `legadoAGrafo` arma la salida recorriendo el ARRAY en fila y pisa `siguiente`: sólo
sirve para listas. Y `tieneLegado` miraba la estrategia y los `delay_horas` aunque los pasos ya
fueran un grafo.

⚠️ **El atajo obvio, «si tiene ids ya es un flujo» (`esGrafo`), es el equivocado.**
`setSecuenciaPasos` le pone `id: o<i>` y `siguiente` explícito a toda lista de antes en el primer
guardado: una lista guardada tiene ids y sigue siendo una lista que se puede convertir.

**Regla:** la pregunta es `esFlujoExplicito`: hay una tarjeta de control, o algún `siguiente` que no
es el elemento siguiente del array. Sobre un flujo, `tieneLegado` contesta false y `legadoAGrafo`
devuelve los pasos normalizados sin tocarlos. Si en un flujo queda algo de antes en un PASO, se
marca en la tarjeta y el motor lo sigue haciendo; si queda en la ESTRATEGIA, se limpia al publicar.
Vale para el lienzo, «Probar» y `scripts/migrar-secuencias-a-grafo.mts`.

**Vive en:** `lib/flujo-legado.ts` (`esFlujoExplicito`, `tieneLegado`) ·
`app/chatbot/SecuenciaPerfil.tsx` · `lib/simulador-grafo.ts` (`flujoParaProbar`)

### La LIMPIEZA conserva el logro: `logrado: 'ninguno'` parecía inerte y no lo era [motor-4, motor-8, lienzo-8]

**Síntoma:** después de convertir #212 y #213, el lead que contestaba quedaba en 'respondio' para
siempre: cuando reagendaba no le salía la post-agenda de la reunión nueva (decisión del 06/10:
«también con reunión nueva») y además bloqueaba la otra mitad. Y el redactor de «MaKo contesta» le
escribía otra cosa que antes, para el mismo caso.

**Causa:** la limpieza pisaba `desenlace.logrado` con 'ninguno'. Con 'respondio', `evaluarDesenlaces`
era lo único que cerraba como lograda la inscripción del que contestó; y `responderSimulador` le
dice al modelo cuándo se cumplió el objetivo con ese mismo campo («esta secuencia no cierra sola» en
vez de «el lead contesta cualquier cosa»).

**Regla:** `limpiezaPara(est)` conserva `logrado` y apaga sólo lo que ahora hacen las tarjetas: la
etapa, el «sigue con» y el fallo por silencio. Con `agendo`/`pago` en un flujo, `evaluarDesenlaces`
no interrumpe: lo hacen las condiciones. Y **sin estrategia no hay nada que limpiar**:
`estrategiaConLimpieza(null)` le inventaba `objetivo: 'agendar'` a una secuencia que no tenía
ninguno, y desde ahí `encadenar()` salteaba a todo lead que ya había agendado. Si una función recibe
null y tiene que «limpiar», devuelve null y quien llama no escribe nada.

**Vive en:** `lib/flujo-legado.ts` (`limpiezaPara`) · `lib/flujo-conversacion.ts`
(`estrategiaConLimpieza`) · `lib/nutricion-desenlace.ts` · `lib/setting-simulador.ts`

### Lo que el conversor genera tiene que existir en el registro [lienzo-2]

**Síntoma:** una secuencia de antes con «Termina si… → etapa» se abría con tarjetas «Acción
mover_lead_etapa» (el id crudo) y no se podía publicar: «"mover_lead_etapa" no es una acción de
MaKo». El script de migración las escribía igual, porque sólo corre `validarGrafo`.

**Causa:** `OP_MOVER_ETAPA` era un nombre que ningún `.def.ts` declara, y `validarGrafo` mira la
forma, no las operaciones.

**Regla:** la operación es `proponer_cambio_etapa`, y un test pasa por `porId` + `esAccion` cada
operación que genera `legadoAGrafo`. Lo que un conversor escribe se valida contra lo que el motor
ejecuta, no contra lo que el conversor cree (`b6f43009`).

**Vive en:** `lib/flujo-legado.ts` (`OP_MOVER_ETAPA`) · `lib/nutricion.ts` (`setSecuenciaPasos`) ·
`tests/flujo-grafo.test.ts`

### Se convierte lo que el motor LEE: la estrategia parseada [M]

**Síntoma:** convertir desde la estrategia CRUDA inventaba casos y desenlaces en secuencias cuyo
motor no los ejecutaba.

**Causa:** `parseEstrategia` devuelve null si falta `objetivo`, y el motor lee la parseada: una
cruda sin objetivo, para él, no es asistida ni tiene desenlace.

**Regla:** `legadoAGrafo` recibe la estrategia PARSEADA, la limpieza va sobre la parseada y el
objeto se guarda entero.

**Vive en:** `scripts/migrar-secuencias-a-grafo.mts`

### Trampas menores del modelo

- **Los ids `n…` son aleatorios a propósito; los `o<n>` son estables** [M]. `nuevoId` no reusa el id
  de un nodo borrado (una inscripción parada ahí seguiría por la tarjeta nueva). Por eso un dry-run
  del script se compara con lo aplicado por los `o<n>` y por la forma, nunca por los ids nuevos.
- **«Ir a» sólo entra en una salida VACÍA** [L]. `insertarNodo` no le cuelga a un salto lo que
  había en ese lugar: insertado en el medio de una flecha, dejaba suelto todo lo que seguía. Lo
  valida `insertarDesdeLienzo`, no sólo el menú del ＋.
- **`textoFila` escribe en días las horas múltiplo de 24 desde 48** [L]: «72 h» sale «3 días». Para
  comparar el texto de una fila, `textoFila` o un número que no sea múltiplo de 24.

---

### Escritores que no saben de ramas aplanaban un flujo sin error [cosecha]

**Síntoma:** encontrado al cosechar, DESPUÉS de convertir en producción #198/#212/#213 (por suerte
antes de que se abriera el onboarding): esas secuencias podían volver a ser una lista de uno o dos
pasos sin que nada avisara, y con la estrategia ya limpia se perdían «Si responde» y sus casos.

**Causa:** `armarSecuenciasDeAudios` (`lib/secuencias-audios.ts`) corre en CADA carga del paso del
onboarding (`GET /api/chat-agent/onboarding/resumen`) y en la operación `armar_secuencias_de_audios`,
y hacía `.update({ pasos: plan.pasos })` directo, sin `setSecuenciaPasos`. ⚠️ El diagnóstico de la
parte del motor («los escritores sin guarda pasan por `setSecuenciaPasos`, lo peor es un 400») era
cierto para /email y falso para éste. Y aunque hubiera pasado por `setSecuenciaPasos`, no habría
fallado: **una lista lineal es un flujo VÁLIDO**, así que `validarGrafo` no tenía nada que objetar.

**Dónde:** `lib/secuencias-audios.ts` (`audiosDeLaListaEnElFlujo`), `lib/nutricion.ts`
(`setSecuenciaPasos` → `puedePisarFlujo`), `lib/flujo-legado.ts`, `tests/flujo-grafo.test.ts`.

**La regla:** sobre un flujo de tarjetas (`esFlujoExplicito`) nadie escribe la lista entera.
Re-grabar un audio le cambia el `audio_id` a su tarjeta (`o<k>`, el id que conserva la conversión) y
nada más. Y la red general está en `setSecuenciaPasos`: si lo guardado es un flujo y lo nuevo no
trae ni un id, se rechaza con «se edita en /chatbot» (el lienzo manda siempre sus ids). Un escritor
nuevo de `pasos` que arme la lista de cero choca con esa red en vez de aplanar en silencio.

## El motor

### La entrada es `raizSalida`, nunca `pasos[0]`, y el índice se traduce en UNA puerta [M, motor-10, lienzo-1]

**Síntoma:** tres caras del mismo dato. Una inscripción que nunca avanzó (`paso_actual` 0,
`nodo_actual` NULL) quedaba parada en «Si responde» cuando el lienzo dejaba esa tarjeta primera en
el array. Un lead de la rama A cuyo nodo se borró recibía el mensaje de la rama B. Y una inscripción
de antes del deploy con `paso_actual = 1`, sobre una #212 publicada desde el lienzo, leía
`pasos[1]` del array nuevo, que es el audio que ya había recibido: le salía otra vez.

**Causa:** `paso_actual` es un ÍNDICE del array, todo lo que inscribe escribe 0, y con ramas el
array cambia de orden en cada conversión o borrado.

**Regla:** `indiceActual` es la única puerta. `nodo_actual` que existe → ése; que ya no existe → -1
(se cierra con rastro); NULL con `paso_actual` 0 → la entrada (`raizSalida`); NULL con k > 0 →
primero el id `o<k>` (el que `legadoAGrafo` conserva) y sólo después el índice. El primer envío al
inscribir lo programa `pasoDeEntrada`.

**Vive en:** `lib/nutricion-grafo-motor.ts` (`indiceActual`, `indiceEntrada`, `pasoDeEntrada`) ·
`lib/nutricion.ts` (`procesarEnvios`, `planificarEnvios`, `pausarPorRespuesta`) ·
`tests/flujo-motor-grafo.test.ts`

### «Lo que viene después» sale de los puertos y de los saltos, nunca del array [M]

**Síntoma:** la regla del canal apagado («¿queda algo enviable después?») contestaba sobre lo que
había más abajo en el array.

**Causa:** ⚠️ el diagnóstico obvio («miremos el resto de los pasos») era el equivocado: con ramas,
lo de abajo puede ser OTRA rama que este lead no va a recorrer.

**Regla:** todo «después» sale de `puertosDe` y de los «Ir a» a una tarjeta (`alcanzablesDesde`),
nunca de `pasos.slice(i + 1)`.

**Vive en:** `lib/nutricion-grafo-motor.ts` (`alcanzablesDesde`) · `lib/nutricion.ts` (`canalOn`)

### En la misma corrida sólo se avanza por lo que no es un mensaje [M]

**Síntoma:** si después de un mensaje se miraba lo que seguía en la misma corrida (`otraVuelta`),
un segundo mensaje pegado quedaba en «saltado: msg <20h» en cada envío.

**Causa:** `leadsConEnvioReciente` se recalcula por lote leyendo la base y ve el envío que se acaba
de hacer.

**Regla:** en la misma corrida se resuelve sólo lo que no es un mensaje (condición, espera,
acción); otro mensaje sale en la corrida siguiente, como siempre.

**Vive en:** `lib/nutricion.ts` (`avanceDesde`)

### «Otra cosa» cierra la CHARLA, no el estado [motor-3, M]

**Síntoma:** en #212/#213 convertidas, el lead escribía algo fuera de guion, «Otra cosa» avisaba, el
dueño se ponía a hablarle a mano… y al mensaje siguiente («listo, confirmo el martes») MaKo le
contestaba solo por el caso «Confirma», en medio de la charla de una persona.

**Causa:** `responderConGrafo` escribía `conversacion_ultima_at` en TODA rama, así que la charla
quedaba abierta y `seguirCharla` la retomaba. Antes la inscripción pasaba a 'handoff' y
`conversacionAbierta` la excluía.

⚠️ **Las dos salidas obvias eran las equivocadas.** Volver a congelar en 'handoff' «como antes»
deja la inscripción sin salida: `avisar_al_equipo` no crea fila en `chat_agent_handoffs` (nadie la
puede resolver), `evaluarDesenlaces` saltea 'handoff', `inscripcionReusable` la cuenta como no
terminada (bloquea la post-agenda al reagendar, la misma clase de bug que la limpieza) y
`resolverHandoff` reactiva sin `proximo_envio_at`, que la cola no levanta nunca. Y cerrar con
`conversacion_cierre = 'handoff'` no se puede: el CHECK de la 0203 sólo admite fin_bien, fin_mal e
insistencia.

**Regla:** un hand-off nuevo cierra la CHARLA: `conversacion_cerrada_at` puesto y
`conversacion_cierre` null EXPLÍCITO (`undefined` quiere decir «no se leyó»). Lo lee
`cerradaPorUnaPersona`, y el motivo sale del ÚLTIMO cierre (`f33578dc`). Si algún día el CHECK suma
'handoff', cambian a la vez los dos escritores y `cerradaPorUnaPersona`. Medido el 08/10: 0
cierres en toda la base.

**Vive en:** `lib/nutricion.ts` (`responderConGrafo`) · `lib/setter-conversacion.ts`
(`cerradaPorUnaPersona`, `conversacionAbierta`) · `supabase/migrations/0203_charla_del_setter.sql` ·
`scripts/migrar-secuencias-a-grafo.mts`

### Un aviso deduplicado no es un aviso que salió [motor-1]

**Síntoma:** en #212, a las 37 h salía la tarjeta «no confirmó» (`avisar_al_equipo`, dedup por lead
12 h). Si dos horas después el lead escribía algo fuera de guion, «Otra cosa» avisaba… y el aviso
se descartaba por dedup. MaKo no contestaba y Mauricio no se enteraba. Y el aviso decía «Te
escribió algo que no sé contestar», sin el mensaje.

**Causa:** `avisoDelFlujo = true` se marcaba ANTES de correr la acción y sin mirar si salió, y eso
apagaba el aviso de respaldo, el único con el texto del lead. Las dos tarjetas usaban el mismo tipo
y la misma clave. El hand-off de antes mandaba el texto literal, sin dedup y con otro tipo.

**Regla:** se marca sólo si la acción emitió de verdad. Como `aplicarEnElActo`
(`lib/api-mako/flujo.ts`) descarta los `datos` del resultado, la señal viaja en el PREFIJO del
resumen (`AVISO_REPETIDO`): una constante que comparten el runner y el motor, con test, nunca una
comparación con texto libre. Y el aviso de «Otra cosa» lleva el texto del lead y una clave por
respuesta.

**Vive en:** `lib/nutricion.ts` (`responderConGrafo`) · `lib/nutricion-grafo-motor.ts`
(`AVISO_REPETIDO`, `avisoSalio`) · `lib/api-mako/areas/chatbot.run.ts` (`avisar_al_equipo`)

### Saltar a otra automatización no reinicia lo terminado [motor-2]

**Síntoma:** el «Sigue con» convertido (`ir_a { secuencia_id }`, #198 → #212) le reenviaba la
secuencia entera a un lead que ya la había completado, quizás para la misma reunión. Apuntando a sí
misma, era un bucle que reenviaba todo en cada vuelta.

**Causa:** el motor lo resolvía con `inscribirEnSecuencia`, que aplica las reglas de la inscripción
MANUAL («lo terminado se puede volver a arrancar»). Antes, `encadenar()` cortaba ante cualquier fila
previa.

**Regla:** desde un flujo, `inscribirEnSecuencia` va con `desdeFlujo`: cualquier fila previa es «ya
estuvo» y además mira `hitoYaHecho`. Un «Ir a» a la propia automatización se rechaza al guardar
(`irAEstaMisma` en `setSecuenciaPasos`: `validarGrafo` no sabe el id de la secuencia).

**Vive en:** `lib/nutricion.ts` · `lib/nutricion-inscripcion-manual.ts` · `lib/nutricion-grafo-motor.ts`
(`irAEstaMisma`)

### Un mensaje fijo de «Si responde» se reclama por (inscripción, nodo) [motor-5]

**Síntoma:** «Otra cosa» → «¡Gracias! En un rato te respondo» se repetía con cada mensaje del lead
durante los 7 días de la charla, sin anti-ban ni tope.

**Causa:** `mandarMensajeDeRespuesta` no tenía reclamo; la acción sí (`reclamarEspaciado`).

**Regla:** antes de mandar, `reclamarEspaciado` por (inscripción, nodo) con 20 h. El costo
aceptado: el reclamo va antes de mandar (la regla de la casa), así que un envío que falló también
ocupa la ventana, y el aviso lo dice («ya salió (o se intentó)»).

**Vive en:** `lib/nutricion.ts` (`mandarMensajeDeRespuesta`)

### Sólo un MENSAJE sube por las condiciones hasta la espera anclada [motor-6, M]

**Síntoma:** con «1 día antes de la reunión → condición → mensaje», si el lead movía la reunión
salía «Mañana es tu reunión» cuatro días antes, o para una reunión cancelada.

**Causa:** `minutosAntesDeReunion` miraba sólo el padre directo, que era la condición: el mensaje
quedaba sin anclar, sin re-anclaje y sin cierre por reunión pasada.

⚠️ **«Subir por todos los padres que no esperan» era el arreglo equivocado:** subiendo también
desde una ACCIÓN, la acción del logro («ya pagó → muévelo»), que cuelga de la condición, quedaba
anclada y se postergaba hasta la reunión nueva.

**Regla:** sólo un mensaje sube por las condiciones hasta la primera espera; una acción mira su
padre directo.

**Vive en:** `lib/nutricion-grafo-motor.ts` (`minutosAntesDeReunion`) · `lib/nutricion.ts`

### Sin la 0223, el webhook se comía la primera respuesta, y tirar ante cualquier error era peor [motor-9, M]

**Síntoma:** desplegado sin la 0223, `pausarPorRespuesta` marcaba la inscripción 'respondio'
(columnas viejas: sale bien) y después `getSecuenciasConStats` pedía `etiqueta_id` y fallaba; el
`catch` se la tragaba. Sin borrador ni aviso, y aplicar la 0223 después no la recuperaba. La
cabecera de la 0223 decía «falla cerrado, nada se pierde» mirando sólo el cron.

**Causa:** PostgREST rechaza la consulta ENTERA si falta una columna, y el orden era marcar → leer.

⚠️ **El arreglo obvio (leer antes de marcar y tirar ante cualquier error) empeoraba otro caso:** ante
un error pasajero el lead quedaba 'activa' y la corrida siguiente le mandaba el próximo mensaje de
prospección a alguien que acababa de contestar.

**Regla:** se tira sólo cuando FALTA UNA COLUMNA (42703 o PGRST204: `esColumnaInexistente`);
cualquier otro error pausa como siempre. Una TABLA que falta es otra cosa (PGRST205 o 42P01:
`esTablaInexistente`) y sí se tolera donde se lee `crm_lead_etiquetas`. «does not exist» aparece en
los dos mensajes: una regex floja confunde columna con tabla. Y la migración va antes del deploy;
un script que lee la columna nueva la prueba al arrancar y con `--aplicar` se niega sin ella. Las
trampas de PostgREST, en [hallazgos-infra.md](hallazgos-infra.md).

**Vive en:** `lib/nutricion.ts` (`pausarPorRespuesta`) · `lib/nutricion-grafo-motor.ts`
(`esColumnaInexistente`, `esTablaInexistente`) · `supabase/migrations/0223_flujo_grafo.sql` ·
`scripts/migrar-secuencias-a-grafo.mts`

### El disparador por etiqueta sin horario es SÓLO el evento [etiquetas-1, datos-1, motor-7]

**Síntoma:** poner una etiqueta en lote, o por el espejo de una etapa, no disparaba en el acto (lo
promete el diseño: «una acción en lote no dispara»)… y en la corrida horaria siguiente el barrido de
la cohorte inscribía a todos los que la tenían: 150 leads, 40 por día por la línea no oficial,
delante de la post-agenda.

**Causa:** `leadsConEtiqueta` devolvía todas las filas de `crm_lead_etiquetas` sin mirar quién la
puso, y una secuencia sin horario da `toca: true` en cada corrida.

⚠️ **El mismo mecanismo salió CONFIRMADO dos veces y REFUTADO una (motor-7) en la misma
revisión.** No se contradicen: el refutador juzga la AFIRMACIÓN, no el mecanismo. «Barre a perdidos
y a leads de hace meses» era una decisión escrita en el código («SIN FILTRO, a propósito»); «el
lote dispara por la puerta de atrás» contradecía una promesa de la pantalla.

**Regla:** sin horario, una secuencia por etiqueta corre SÓLO por el evento; con horario, el barrido
alcanza a los que la tienen, porque eso eligió el dueño al poner el horario. Vive en
`barridoInscribe`. Si Martín quiere que «Se le puso X» sin horario alcance a quien ya la tenía, es
una decisión suya.

**Vive en:** `lib/nutricion-grafo-motor.ts` (`barridoInscribe`) · `lib/nutricion.ts`
(`comprometerInscripciones`, `leadsConEtiqueta`) · el lado de las etiquetas, en
[hallazgos-crm.md](hallazgos-crm.md)

### Elegir un disparador no toca el producto: ausente no es null [motor-11]

**Síntoma:** cambiar el disparador de una secuencia con producto a un evento o a una etiqueta le
escribía `funnel_id: null`, que es «todos los embudos»: la próxima corrida inscribía leads de todos
los productos.

**Causa:** `pedidoDisparo` no manda `funnel_id` para esos disparadores, y la ruta convertía el
ausente en null.

**Regla:** ausente = no se toca; `funnel_id: null` explícito = todos los embudos. La ruta distingue
`'funnel_id' in body`. Hoy no afecta a ninguna fila (0 secuencias con `funnel_id`, medido el 08/10).

**Vive en:** `app/api/chat-agent/secuencias/route.ts` · `lib/setting-secuencias.ts`
(`setTriggerSecuencia`) · `lib/flujo-conversacion.ts` (`pedidoDisparo`)

### Un mensaje que pasa a archivo o a voz suelta sus variantes [costuras-1, C]

**Síntoma:** un paso de texto con variantes (las que escribe MaKo al armar la secuencia) pasaba a
PDF con el caption «Te dejo la info 👇», y a 3 de cada 4 leads les llegaba el PDF con un texto viejo
como caption; con el caption vacío, a todos. «Probar» mostraba el bueno (`p.cuerpo`), así que la
prueba no lo detectaba.

**Causa:** `pasoAMedia` no tocaba `variantes`, y `textoDelPaso` sólo cortaba el sorteo para un
audio.

⚠️ **«El editor no manda el cambio» era el diagnóstico equivocado:** el editor sí manda
`variantes: []`; el merge de `setSecuenciaPasos` trata un `[]` igual que la clave ausente y repone
las guardadas.

**Regla:** `textoDelPaso` devuelve `cuerpo` para audio y archivo; `pasoAMedia` y `pasoAVoz` dejan
`variantes: []`; el «↻ N» sólo se dibuja en un mensaje de texto. Y un merge que conserva un campo
cuando «no viene» separa ausente (`undefined`) de vacío (`[]`), o la persona no puede borrar ese
campo nunca. Esa última mitad NO está hecha (ver abajo).

**Vive en:** `lib/nutricion-canal.ts` (`textoDelPaso`) · `lib/guion-audio.ts` (`pasoAMedia`,
`pasoAVoz`, `cambiosDePaso`) · `app/chatbot/EditorMensajeWhatsApp.tsx` · `lib/nutricion.ts`
(`setSecuenciaPasos`)

### Las guardas de texto del motor anclaban en la forma del modelo viejo [M]

**Síntoma:** al pasar el motor al grafo se pusieron rojos 29 tests sin un solo bug de
comportamiento.

**Causa:** las guardas anclaban en expresiones literales del modelo de antes:
`sec.pasos[insc.paso_actual + 1]`, `insc.paso_actual === 0 && sec.antiguedad_max_horas`,
`.update({ pasos: limpio`, el cuerpo entero de `asistirRespuesta`.

**Regla:** antes de cambiar el modelo de un motor, se grepean sus anclas en `tests/`, y se ancla en
funciones o constantes con nombre (`topeAntiguedad`, `avanceDesde`, `anclada`), no en la forma de
una expresión. Dos más del mismo día:
- la guarda `/linea:/` no ve una propiedad abreviada (`{ …, linea }`): en las llamadas que una
  guarda cuenta por texto, la propiedad va explícita (`linea: c.linea`);
- `tests/nutricion-canal.test.ts` mide el tramo entre `const limpio = pasos` y `const { error } =`
  con un tope de 4000 caracteres: las validaciones nuevas de `setSecuenciaPasos` van ANTES de
  `const limpio`.

Y una del typecheck: `filtros: (q) => q.not(...) as ConsultaPaginada` dio TS2589 («Type
instantiation is excessively deep») en `hechosDeLeads`; con `.not` va sin el cast, como en el resto
del repo.

**Vive en:** `tests/antiguedad-cableada.test.ts` · `tests/setter-conversacion.test.ts` ·
`tests/lineas-whatsapp.test.ts` · `tests/nutricion-canal.test.ts` · los `tests/nutricion-*.test.ts`

---

## El lienzo

### Lo que la casilla pinta como heredado sale de la regla del motor [costuras-3, L]

**Síntoma:** en una secuencia que sale sola, «＋ caso» en «Si responde» creaba el «MaKo contesta»
con la casilla «Revisar antes de enviar» destildada (promete que sale sola), y el motor dejaba un
borrador: el lead no recibía respuesta hasta que alguien la aprobara.

**Causa:** el editor pintaba `paso.revisar ?? !envio_automatico` para cualquier mensaje; para un
`tipo: 'ia'` de «Si responde», el motor exige `revisar === false` estricto (`escenariosDeRespuesta` →
`contestaSolo`). Y `agregarCaso` creaba el mensaje sin `revisar`.

**Regla:** el valor heredado sale de la MISMA regla del motor (`revisarHeredado`, que llama a
`saleSolo` y a `escenariosDeRespuesta`, los dos puros), fijado con un test de MATRIZ que compara lo
que se pinta contra lo que hace el motor. La matriz no caza el valor con el que NACE un caso (pone
`revisar` a mano en cada vuelta): hacen falta los dos tests, el del nacimiento y el de la herencia.
`agregarCaso` crea con `revisar: true`, como el conversor.

**Vive en:** `lib/flujo-conversacion.ts` (`revisarHeredado`, `agregarCaso`) ·
`app/chatbot/FlujoLienzo.tsx` · `lib/nutricion-grafo-motor.ts` (`saleSolo`)

### Una tarjeta se nombra con lo que dibuja, y el error abre la tarjeta [L, lienzo-6]

**Síntoma:** primero, las tarjetas recién agregadas se publicaban vacías y los errores nombraban ids
(`n0abcde`). Después del primer arreglo, Publicar decía «Falta completar "Mensaje 4"» y ninguna
tarjeta lleva número: era la segunda «MaKo contesta».

**Causa:** `validarGrafo` mira la forma y no el contenido, y escribe con ids. `nombreDeTarjeta`
numeraba por el orden del array contando todas las clases de mensaje.

**Regla:** Publicar corre `validarGrafo` y después `faltaEscribir`, antes del PATCH. Una tarjeta se
nombra con su título visible más un trozo de lo que dice, y el título lo calcula UNA función que
usan el árbol y los errores (`tituloDeTarjeta`). Todo error, propio o del server, pasa por
`errorLegible`, que se come el sustantivo de `validarGrafo` («la condición X»; si no, queda «la
condición "Condición"»). Y el error ABRE la tarjeta culpable (`tarjetaDelError`).

**Vive en:** `lib/flujo-conversacion.ts` (`faltaEscribir`, `nombreDeTarjeta`, `tituloDeTarjeta`,
`tarjetaDelError`, `errorLegible`) · `app/chatbot/SecuenciaPerfil.tsx`

### Una tarjeta con salidas tiene alto FIJO: se mide por partes [L, costuras-7]

**Síntoma:** la nota de voz se cortaba: ni el pie (el link) ni el «Dice: …» se veían nunca, así que
una nota con link se veía igual que una sin link.

**Causa:** el punto de cada salida lo dibuja el lienzo AFUERA de la tarjeta, contado desde el pie
(`yDePuerto`). Por eso una tarjeta con `puertos` tiene alto fijo (`nodo.alto`) y `overflow: hidden`:
si creciera con su contenido, cada flecha saldría de la fila de al lado. Y el layout puro no sabía
si el audio tenía transcripción.

**Regla:** lo que se pinta adentro tiene que caber en el alto estimado; si no cabe, se ajusta la
estimación (`altoDeMensaje`, por partes y con las constantes de los estilos que la dibujan), nunca
el alto de la tarjeta. Lo que el layout puro no sabe le llega por una opción (`audioDe`).

**Vive en:** `lib/lienzo-grafo.ts` (`yDePuerto`, `ALTO_PUERTO`, `PIE_PUERTOS`) ·
`app/_components/Lienzo.tsx` (`TarjetaNodo`) · `lib/flujo-conversacion.ts` (`altoDeMensaje`)

### Una lectura que falla no es una lista vacía: la biblioteca tiene tres estados [costuras-6, costuras-11]

**Síntoma:** toda tarjeta de archivo decía «(no disponible)», o «document (no disponible)» sin
caption, sobre un PDF sano. Y una etiqueta archivada en una condición salía «Una etiqueta que ya no
está»: el dueño la reemplazaba creyendo que se había borrado.

**Causa:** la tarjeta le pasaba a `BurbujaHilo` un archivo con `url: null`, y la burbuja dice «(no
disponible)» siempre que falta la url. Y el lienzo pedía `/api/crm/etiquetas` sin `archivadas=1`.

**Regla:** la biblioteca se lee con tres estados (ok / error / cargando) y sólo «ok sin el id»
afirma que falta: con `[]` ante un error, la tarjeta diría «Un archivo que ya no está». Lo que se
busca por id para NOMBRARLO se pide incluyendo lo archivado. `GET /api/chat-agent/adjuntos` es sólo
para admin: un setter ve «Archivo».

**Vive en:** `lib/flujo-conversacion.ts` (`vistaDeArchivo`) · `app/chatbot/FlujoLienzo.tsx` ·
`app/chatbot/SecuenciaPerfil.tsx`

### Un guard de layout mide el ANCLAJE, no sólo que nada se pise [L]

**Síntoma:** el test «dos ramas no se pisan» seguía en verde con el bloque de ramas mal medido.

**Causa:** ⚠️ el diagnóstico obvio era el equivocado: ese error no produce solapes, porque el
apilado igual suma lo que cada subárbol sube por encima de su tope. Lo que rompe es el CENTRADO: el
bloque baja y las ramas de arriba dejan de estar arriba del puerto.

**Regla:** un guard de layout mide qué queda centrado contra qué. «No se pisan» lo garantiza el
apilado aunque la cuenta esté mal.

**Vive en:** `lib/flujo-conversacion.ts` (`bloque`, `medir`, `colocar`) ·
`tests/flujo-conversacion.test.ts`

### Con «Probar» abierto, la tarjeta a editar caía debajo del teléfono [lienzo-4, L]

**Síntoma:** al tocar una tarjeta con «Probar» abierto, la vista se corría hasta dejarla debajo del
panel; sin «Probar», se corría a x = 1024 y se cortaba contra el borde.

**Causa:** `vistaConPanel` hacía `panelAncho + margen * 2` con `margen = 12 + insetIzq`: el inset
izquierdo se contaba dos veces, y no había límite a la derecha.

⚠️ **El límite derecho ENMASCARA el error doble:** con «Probar» abierto el límite corta antes y el
test pasa igual; la rotura sólo se ve en el caso sin «Probar». Un límite nuevo se prueba también
donde no actúa.

**Regla:** un margen que ya incluye un inset no es simétrico: el borde libre se calcula una vez
(inicio + ancho + separación) y todo corrimiento lleva el tope del otro lado (`insetDer`). Es la
regla de AGENTS.md «Apoyar algo sobre el borde de un lienzo», del lado derecho.

⚠️ **Y el comentario del panel miente.** Dice que `panelAncho` es ancho de CONTENIDO, y
`app/globals.css` tiene `* { box-sizing: border-box }`: es el ancho exterior, y el `+ 30` del
`maxWidth` le saca 30 px de más en ventanas angostas. El reporte de construcción de L afirmaba lo
contrario; el de los arreglos leyó el reset global y lo desmintió. Antes de razonar sobre el modelo
de caja de una pieza compartida, se mira el reset global.

**Vive en:** `lib/lienzo-grafo.ts` (`vistaConPanel`) · `app/_components/Lienzo.tsx` (el `maxWidth` del
panel del nodo)

### Todo cambio sube como función del estado anterior, y «es tipear» es una propiedad del cambio [L, costuras-9, lienzo-7]

**Síntoma:** el composer manda dos cambios en el mismo tick (`onChange({ tipo })` y `onModoIA(on)`) y
el segundo pisaba al primero, cada uno con su foto de deshacer. Y tipear una variante apilaba una
foto por tecla: a los 30 caracteres se perdía la foto de antes de borrar una rama.

**Causa:** las closures de un mismo render ven los mismos `pasos`; y `soloTexto` aceptaba sólo
`cuerpo` y `asunto`.

**Regla:** todo cambio sube como FUNCIÓN del estado anterior (`onPasos(fn, apilar)`), con UNA foto
por tick (una bandera que limpia `queueMicrotask`); un cambio que no pasa por `onPasos` no se
deshace. «Es tipear» es mismo campo y misma forma (mismo largo de la lista): agregar o quitar una
variante sí apila (`cambioApila`).

**Vive en:** `app/chatbot/SecuenciaPerfil.tsx` (`onPasos`, `fotoAntes`) · `lib/flujo-conversacion.ts`
(`cambioApila`) · `app/chatbot/FlujoLienzo.tsx`

---

## «Probar» y la página

### El simulador corre el MISMO dato con las MISMAS funciones que el motor [P]

**Síntoma:** «no puedo interactuar para probarlo de verdad» (punto 10 del pedido).

**Causa:** ⚠️ el diagnóstico obvio (un bug de UI: el composer tapado, el chat en `readOnly`) era la
mitad. El simulador viejo recorría `pasos` con su propio orden (todos los de WhatsApp, también los
que se excluyen entre sí), resolvía variables con su propio reemplazo y contestaba con un setter
libre. La #198 tiene 0 casos: en producción toda respuesta iba a hand-off y MaKo callaba, y en el
simulador MaKo contestaba igual.

**Regla:** «Probar» usa `raizSalida`, `siguienteDe`, `claseDe`, `clasificarEscenario` con
`escenariosDeRespuesta` y el redactor de producción (`responderSimulador`); las variables, con
`aplicarVariables` y los ejemplos del catálogo. Sin «Si responde» dice «MaKo no contesta», que es lo
que pasa en producción. Y prueba lo de la PANTALLA: re-elegir en la lista la misma automatización
vaciaba la edición local y volvía a lo publicado [lienzo-5].

**Vive en:** `lib/simulador-grafo.ts` (`flujoParaProbar`, `iniciar`, `siguiente`, `elegir`) ·
`app/chatbot/PanelProbar.tsx` · `app/chatbot/SimuladorWhatsApp.tsx`

### Todo destino «a mi…» sale de la fila propia de la sesión [P, lienzo-3]

**Síntoma:** «A mi WhatsApp» venía precargado con el contacto de reportes del workspace. En el ws1
es el de Mauricio: si Martín probaba el flujo de un cliente, la prueba le llegaba al cliente, bajo el
rótulo «Tu número».

**Causa:** `user_telefono` y `user_email` son el contacto de REPORTES del workspace, no de quien
mira.

⚠️ **El arreglo obvio era el equivocado:** `getPerfil()` (`lib/perfil.ts`), con un admin parado en
un workspace ajeno, devuelve el perfil del ADMIN DEL CLIENTE (`usuarioDelPerfil`, «viendo como
cliente»): justo la persona a la que no hay que escribirle.

**Regla:** el destino sale de la fila PROPIA de la sesión (`getUsuarioActual`, y si no,
`buscarUsuarioPorEmail(sesion.email)`); sin fila propia, vacío. El campo es editable, el interruptor
nace apagado y el destino NO se guarda nunca (guardarlo cambiaría a dónde le llegan los reportes al
dueño). El primer mensaje real lleva «🧪 Prueba de MaKo», decidido en el server.

**Vive en:** `lib/simulador-grafo.ts` (`destinoDelQueMira`) · `app/api/chat-agent/simulador/route.ts`
(GET `?destino=1`) · `lib/perfil.ts` · `tests/chatbot-probar.test.ts`

### Lo que se repite SOLO no se reenvía; lo que dispara quien prueba, sí [datos-4, P]

**Síntoma:** con «A mi WhatsApp» prendido, un flujo mensaje → esperar → «Ir a» el mismo mensaje
mandaba unos 21 WhatsApp idénticos en segundos por la línea no oficial: el simulador no espera y
repite hasta `TOPE_SALTOS = 20`. Y la ruta mandaba texto libre a cualquier número, sin tope.

**Causa:** el envío real colgaba de cada mensaje dibujado, y el server no contaba.

⚠️ **Un Set por tarjeta habría silenciado respuestas legítimas:** en «Si responde» la misma «MaKo
contesta» corre en cada turno con un texto nuevo.

**Regla:** lo que se repite solo (un «Ir a» que vuelve, en la salida o en el mismo turno) no se
reenvía; lo que dispara quien prueba (un mensaje nuevo como lead) sí: la clave lleva el turno
(`debeSalirDeVerdad`). Y el server topea por destino: N por ventana se arma con N casilleros de
`reclamarEspaciado`, que es un compare-and-set sobre UNA marca por clave (`reclamarCupoPrueba`); se
reclama después de los chequeos que pueden cortar, y si el conteo falla no se manda. Costo: hasta 11
filas de `app_settings` por destino probado, que nadie limpia.

**Vive en:** `lib/simulador-grafo.ts` (`debeSalirDeVerdad`, `reclamarCupoPrueba`) · `lib/prueba-paso.ts` ·
`app/chatbot/PanelProbar.tsx`

### Un pedido de abrir algo desde afuera baja como OBJETO y se aplica al dibujar [costuras-5, P]

**Síntoma:** el link del aviso de hand-off (`/chatbot?sec=<id>`, «súmalo como caso en "Si
responde"») abría el wizard de 9 pasos, donde no hay «Si responde».

**Causa:** el ancla del deep link era de cuando el wizard era el editor.

**Regla:** el pedido baja como un objeto nuevo por pedido (comparado por identidad: el mismo id dos
veces vuelve a abrir) y se aplica AL DIBUJAR con el patrón de estado previo, no en un efecto (un
efecto pinta primero la primera de la lista). `tests/chatbot-probar.test.ts` cruza el
`linkApp('/chatbot?<param>=')` de `lib/chat-agent-handoff.ts` con el `params.get` de la página: si
el aviso cambia de parámetro, el test cae.

**Vive en:** `app/chatbot/ChatAgentApp.tsx` · `app/chatbot/SimuladorWhatsApp.tsx` (prop `abrir`) ·
`lib/chat-agent-handoff.ts`

### La pantalla ofrece lo que el emisor hace, nada más [P]

**Síntoma:** en el recordatorio de la reunión dibujado como tarjetas, «quitar un toque» parecía una
capacidad natural.

**Causa:** el emisor no la tiene: guarda sólo los textos propios (uno vacío vuelve al de fábrica) y
recorre siempre los tres toques (1440, 60 y 15 min).

**Regla:** un «quitar» que el emisor ignora es un botón roto. Para apagar un toque, primero el
emisor (un `apagado` por toque en el setting) y después la tarjeta. La pantalla escribe por la MISMA
ruta y la MISMA clave (`chatbot.recordatorio_reunion`): mudarla de lugar no lo apaga ni lo duplica.

**Vive en:** `app/chatbot/RecordatorioFlujo.tsx` · `lib/recordatorio-lead.ts` ·
`lib/reunion-recordatorio.ts`

### Trampas menores de «Probar»

- **Un documento va con `nombreArchivo` y el caption aparte** [costuras-8]: sin eso, `ChatHilo` usa
  el texto como nombre del archivo y el caption no sale.
- **`PanelProbar.tsx` conserva a propósito un `eslint-disable` de react-hooks** (el efecto de
  montaje): con eso el React Compiler saltea el componente entero (ver
  [hallazgos-ui.md](hallazgos-ui.md)).

---

## Las costuras entre las partes

### Repartir por archivo dejó capacidades sin enchufar [revisión, integración]

**Síntoma:** de los 42 confirmados de la revisión, 11 eran «costuras»: cosas que cada parte hizo
bien y que se cayeron entre dos. La más cara, una regresión: el lienzo dejó de pasarle `paraGuion`
al editor y «✦ guion» perdió objetivo, gancho y preguntas (en un negocio sin link de agenda, todo
guion que dijera «agendemos» volvía a terminar en «Prueba de nuevo»). Además, la prop `handoffs` de
`SecuenciaPerfil` nació con cero call sites (la marca de «Otra cosa» no se veía hasta `1b0e2515`),
`SecuenciaDto` no declaraba `etiqueta_id`, `EstrategiaWizard` quedó huérfano y
`app/admin/dev/areas.ts` no conocía los archivos nuevos (`75402dd7`).

**Causa:** la forma del reparto, ya escrita en AGENTS.md («repartir trabajo por archivo garantiza
salidas huérfanas»): la capacidad queda en un archivo y el call site en el de otra parte.

**Regla:** cada parte declara en su reporte, con las líneas exactas, lo que no pudo enchufar (las
«notas para integrar» de esta corrida lo hicieron, y por eso se cerró en horas); el integrador
grepea cada prop nueva y cuenta sus call sites antes del commit.

**Vive en:** `app/chatbot/FlujoLienzo.tsx` (`paraGuion`) · `app/chatbot/SimuladorWhatsApp.tsx`
(`handoffs`) · `app/chatbot/ChatAgentApp.tsx` (`SecuenciaDto`)

### Estado de producción (medido con SELECT)

- **08/10/2026, al cerrar la primera tanda:** ni la 0223, ni la 0224, ni la 0225 estaban aplicadas.
  ⚠️ Es una afirmación CON FECHA: el mismo día se aplicaron, y la conversión de las 6 secuencias
  corrió. La segunda tanda la leyó como estado actual y dos relevos la repitieron.
- **09/10/2026, al cerrar la segunda:** 0223-0225 y **0228** aplicadas (`hilos`, `hilos_rev` y el
  CHECK `nutricion_inscripciones_hilos_chk`, verificados contra information_schema y pg_constraint);
  0 inscripciones activas en toda la base.

---

## La segunda tanda (08-09/10/2026): un solo CRON, hilos en paralelo, editores anchos, IA

El pedido (11 puntos), el diseño y las 16 decisiones están en docs/chatbot-flujo-ramas-diseno.md →
«SEGUNDA TANDA». Se construyó en 7 partes (modelo + 6 en worktrees) y una revisión adversarial de
5 frentes: 38 hallazgos, 32 confirmados por un verificador independiente, los 32 arreglados con test.

### Una flecha en paralelo es un PUERTO, y así el modelo no tuvo que cambiar sus recorridos [modelo]

**Qué:** `paralelos?: string[]` en mensaje, acción, espera y el nodo `inicio` (id `'entrada'`, se crea
sólo con la primera flecha desde el CRON y va al FINAL del array para no correr índices).
`puertosDe` los devuelve como `par:<id>`, así `apuntados`, `padreDe`, `descendientes`, la regla de un
padre y las sueltas siguieron andando sin tocarlos. Lo que sí hubo que escribir: `raicesSalida`,
`hiloDe` ('p' el principal, el id de la primera tarjeta de cada flecha, 'r' «Si responde') y las
reglas de `validarGrafo` (paralelos en un bucle de «Ir a» = un hilo nuevo por vuelta; «Ir a» de la
salida a otro hilo = el mismo mensaje dos veces).

**La regla:** una clase nueva de nodo pasa por DOS lugares del guardado con dueños distintos: el
saneo (`camposDelFlujo`) y el relleno (`esNodoDeControl`). Sanear la clase no alcanza: el inicio se
guardaba como si fuera un mensaje. Y `PasoSecuencia` copiaba a mano la unión de `nodo`: al ampliar una
unión del contrato, los tipos copiados y los `switch` exhaustivos de afuera se cuentan antes.

**Vive en:** `lib/flujo-grafo.ts` · `lib/nutricion-grafo-motor.ts` (`camposDelFlujo`) · `lib/nutricion.ts`

### Un compare-and-set por revisión sólo protege si TODOS los escritores suben la revisión [motor]

**Síntoma (revisión):** una escritura del motor leída antes de que el lead contestara revivía los
hilos congelados y pisaba la tarjeta del «Ir a» de «Si responde».

**Causa:** las dos retomas (`responderConGrafo` y el destrabe de `pausarPorRespuesta`) escriben
`hilos: null` sin subir `hilos_rev`; la fila volvió a 'activa' y la revisión seguía igual, así que el
CAS del motor pasaba. ⚠️ Y el diagnóstico obvio al revés también es falso: perder el CAS NO dice «otra
corrida movió este hilo»: cualquier hilo de la fila sube la revisión. Al perder se relee y se pregunta
por ESTE hilo (`hiloSigueEn`).

**La regla:** si el CAS es por la versión de la fila, exige también la FORMA leída (`not hilos is null`
cuando se leyó con hilos), o todos los escritores suben la revisión.

**Vive en:** `lib/nutricion.ts` (`escribirHilos`) · `lib/nutricion-hilos.ts`

### En modo hilos, el estado del ÚLTIMO hilo que cierra es el de la inscripción [motor]

**Síntoma (revisión):** mismo lead, mismos WhatsApp recibidos: el «no confirmó» salía o no según qué
hilo cerraba último. Un email terminal (sin email, dado de baja) cerraba su hilo 'cancelada'; si era el
último, la inscripción entera quedaba 'cancelada' y el desenlace la saltaba.

**La regla:** todo cierre de hilo con estado terminal se prueba en los DOS órdenes. Con hilos, lo
terminal de un email cierra 'completada' (el silencio se mide igual desde el último envío real).

**Vive en:** `lib/nutricion.ts` · `lib/nutricion-hilos.ts` (`aplicarAHilo`) · `lib/nutricion-desenlace.ts`

### «Vuelve a la cola» se decidía en TRES caminos, y el nuevo concepto entró en dos [motor]

**Síntoma (revisión):** un hilo «Enseguida» que arrancaba una acción esperaba una hora; detrás de un
mensaje o una espera salía en la misma corrida.

**La regla:** si una decisión del motor se repite en varios caminos, va en UNA función que llamen
todos; al sumar un concepto (hilos), `grep` de `otraVuelta = true` y revisar cada condición. Y lo nuevo
del motor va FUERA de `procesarEnvios` (un test lo recorta con tope de 40.000 caracteres).

**Vive en:** `lib/nutricion.ts` (`procesarEnvios`)

### El freno anti-ban y los topes son POR CANAL, y eso cambia también a los flujos de antes [motor]

`qNutri` y `enviosUltimas24h` contaban todos los canales y el freno se calculaba una vez por lote:
WhatsApp y email del mismo CRON salían con 20 h de diferencia, y dos hilos de WhatsApp en la misma
vuelta. Ahora los 20 h y los topes miran WhatsApp, el email tiene su propio freno y su tope
(`MAX_EMAIL_POR_DIA` = 100), y `enviadoEnCorrida` se actualiza tras cada envío. ⚠️ No es «modo hilos»:
un email masivo ya no frena 20 h al WhatsApp del mismo lead en NINGÚN flujo. Medido: 0 inscripciones
activas al desplegar.

**Ventana 9-21:** se decide con `zonaDelMotor` (`mako.timezone`; sin zona, Ciudad de México como
siempre). El ws1 NO tiene `mako.timezone`; ws9/10/13/14/15 son Buenos Aires. Para MOSTRAR una hora va
`tzDeWorkspace`. Guardar la zona del ws1 (America/Tijuana) es una decisión de Martín.

**Vive en:** `lib/nutricion.ts`

### Una validación nueva dentro de una escritura que corre un `ejecutar()` consume la pendiente [motor]

Activar pasó a validar lo mismo que Publicar (decisión 15) adentro de `setSecuenciaActiva`, que es lo
que corre el «sí» de la pendiente `nutricion_toggle`: el sí se consumía y contestaba error. La misma
validación va exportada y la corre quien PROPONE. Regla de AGENTS.md («falla en preparar()»), aplicada
a un throw nuevo en una función vieja: grepear quién la llama desde un `ejecutar()`.

**Vive en:** `lib/nutricion.ts` (`setSecuenciaActiva`, `setSecuenciaPasos(…, { soloValidar })`) · `lib/mako-doer-acciones.ts`

### Lo que un editor OFRECE sale de la regla que lo RECHAZA al guardar [modelo]

El lienzo ofrecía «＋ En paralelo» y destinos de «Ir a» que Publicar después rechazaba: `admiteParalelo`
y `tarjetasParaIrA` reescribían a mano PARTE de `validarGrafo` y se olvidaron del bucle. Para ofrecer un
valor se corre la regla sobre el flujo hipotético con ese valor puesto. (Queda: «Crear con IA»
—`problemaDeSalto`— todavía copia reglas en vez de usar `repartenEnBucle`.)

**Vive en:** `lib/flujo-conversacion.ts` · `lib/flujo-grafo.ts` (`repartenEnBucle`) · `lib/flujo-ia.ts`

### Lo que flota sobre un lienzo se mide contra la SALIDA del encuadre, no sólo contra los insets [ui]

La caja de «Crear con IA» centrada entre los insets caía EXACTAMENTE encima del CRON, porque
`encuadreInicial` centra el grafo en el mismo lugar. El encuadre le reserva su franja (`franjaIA`,
`lib/crear-ia-lugar.ts`). Y el envoltorio de una capa con `pointerEvents: auto` mide lo mismo que lo que
dibuja: el aire transparente también come clics. Lo que tiene un pedido en vuelo se ESCONDE, no se
desmonta (desmontar cancela la IA).

**Vive en:** `app/chatbot/SecuenciaPerfil.tsx` · `lib/crear-ia-lugar.ts`

### El panel apaisado llega al rincón de abajo a la derecha y necesita capa propia [modelo, ui]

Sin z-index, la esquina de avisos tapaba «Revisar antes de enviar» del editor en fila. Capa entre 55
(esquina de avisos) y 60; los modales arrancan en 130. El contenido va en columna flex con `flex: 1` +
`min-height: 0` (los editores anchos estiran así; nada de `height: 100%`).

**Vive en:** `app/_components/Lienzo.tsx`

### Crear con IA: lo que el modelo inventa se repara con código, y hay cosas que no se ven en los tests [ia]

- **Un id, una etiqueta, un link o un monto nunca vienen del modelo**: la etiqueta por nombre (o se
  crea), el link desde una clave, y un monto de Ganado vale sólo si aparece literal en lo que escribió
  una persona. Las `{{variables}}` en los datos de una ⚡ Acción se borran (`aplicarVariables` corre
  sólo sobre mensajes: llegarían con llaves al grupo).
- **Dos padres y uno es una espera: gana la espera** (sólo existe para demorar lo que sigue). Lo
  encontró una salida REAL de Groq que pasaba `validarGrafo`; las fixtures escritas a mano no.
- **Lo que puede CREAR una referencia se resuelve antes de decidir qué se crea** (el disparador por
  etiqueta nueva quedaba `etiqueta:-2`).
- **Un callback que se llama al final de un pedido largo va por un ref**: la prop capturada al clic
  comparaba contra el lienzo de hace un minuto.
- **Cancelar sólo se dibuja mientras el server todavía lo respeta**, y un 409 por estado viejo
  devuelve lo guardado.
- **La key de Gemini de PLATAFORMA está bloqueada por Google** (403 «Your project has been denied
  access»): una prueba «con la key de plataforma» no prueba nada; se probó por Groq.
- **El voseo de la salida no lo caza `marcasDeVoseo`** (lista corta a mano): el detector bueno vive en
  `tests/puente-panel-copy.test.ts`. Mudarlo a `lib` está sin hacer.
- **Lo que una pantalla decide con un módulo que tiene prompts va en un módulo aparte**
  (`lib/flujo-ia-cliente.ts`): importar un valor de `lib/flujo-ia.ts` desde un `'use client'` se lleva
  los prompts al navegador.

**Vive en:** `lib/flujo-ia.ts` · `lib/flujo-ia-cliente.ts` · `app/api/chat-agent/secuencias/ia/route.ts` · `app/chatbot/CrearConIA.tsx`

### Un estado sembrado de una prop que el SERVER cambia bajo el mismo `key` [ui]

Después de «Crear con IA», el CRON decía «A mano»: `disparo` se sembraba una vez y la ruta de IA cambia
el disparador en el server sin cambiar el id. Se resiembra comparando una firma en el render. Lo mismo
con la caché de etiquetas: una ruta del SERVER que crea entidades obliga a quien recibe su respuesta a
invalidar la caché (`avisarCambioEtiquetas`).

**Vive en:** `app/chatbot/SecuenciaPerfil.tsx` · `app/_components/etiquetas-cliente.tsx`

### Cal.com: las respuestas, el aviso y lo que la pantalla promete [datos]

Las respuestas se deduplican por clave (`responses` primero; `userFieldsResponses` repite), se saltean
las ocultas, y lo que ya es un campo de la reserva se excluye en positivo. ⚠️ Un jsonb no conserva el
orden de las claves: comparar con `JSON.stringify` contra lo guardado habría insertado de nuevo cada
reentrega. Un emoji cortado en el tope deja un sustituto suelto y Postgres rechaza el jsonb ENTERO
(se perdían todas las respuestas). Y el aviso dice «+N en el resumen»: el resumen tenía que leer ESA
tabla (`lead_respuestas`).

**Vive en:** `lib/calcom.ts` · `app/api/webhooks/calcom/route.ts` · `lib/leads.ts` · `lib/lead-respuestas.ts`


## La tercera tanda (09/10/2026): condiciones de todo el negocio, CRON por producto, editores medidos

Pedido literal en la bitácora (9 oct 02:05); decisiones en docs/chatbot-flujo-ramas-diseno.md →
«TERCERA TANDA». Seis partes en worktrees y una integración: 6035 tests, typecheck 0.

### Una condición devuelve sí, no o «no sé», y «no sé» no se cumple ni negada [condiciones]

`lib/condiciones-catalogo.ts` tiene 48 condiciones por sección y ámbito (adquisición = CRM; entrega =
Customer Success), y cada una sale de un dato que el motor lee en BATCH (`hechosDeLeads(db, ids,
filas)` lee sólo las fuentes que piden los flujos del lote). «No asistió a la R1» negado salía para
quien todavía no tuvo la reunión: un no-show exige la asistencia registrada como «no asistió», no la
falta de reunión. Y lo que no tiene un dato que lo registre no se ofrece: «Confirmó la asistencia» y
«Reagendó» no existen en ningún campo; la sección «Plan» tampoco (la unión tarea→lead está puesta en 6
de 776 tareas, medido).

**Vive en:** `lib/condiciones-catalogo.ts` · `lib/flujo-grafo.ts` (`cumpleFila`) · `lib/nutricion.ts` (`hechosDeLeads`) · `app/chatbot/EditorCondicion.tsx`

### «+y» que creaba «+o»: agregar y elegir el modo son dos decisiones [condiciones]

Los dos botones agregaban una fila con un «Agendó» de relleno Y fijaban el modo de la rama entera, así
que el separador de todas las filas cambiaba con el último tocado. Ahora «＋ Condición» abre el
desplegable por secciones y la fila nace al elegir; «Todas / Cualquiera» es su propio control. Y una
rama (o una condición) nueva nace VACÍA: validarGrafo la frena hasta que se elija algo.

**Vive en:** `app/chatbot/EditorCondicion.tsx` · `lib/flujo-conversacion.ts` (`agregarRama`, `nodoNuevo`)

### Lo que pide una etapa se calcula sobre el embudo REAL, no sobre el pipeline de fábrica [acciones]

El diagnóstico obvio para «Mover de etapa» era «ganado pide monto, perdido pide motivo» sobre
`DEFAULT_PIPELINE`. Lo que pide una etapa sale de `cfg.stages` del embudo del producto
(getFunnelDe/buildFunnel), y para elegir A DÓNDE mover hacen falta todas las etapas, incluidas las
salidas (`productosConEtapas` las filtra: la ruta nueva `app/api/flujos/opciones` las lee sin filtrar).
⚠️ `proponer_cambio_etapa` sólo mueve en el producto principal: el producto del editor es una
referencia hasta que la acción acepte `embudoId`. Y un parámetro que la acción no declara viaja en los
params sin error: un nombre mal escrito desaparece igual de callado.

**Vive en:** `app/_components/EditorAccionMako.tsx` · `app/_components/CamposAccion.tsx` · `lib/editor-acciones.ts`

### Crear con IA fallaba porque el único proveedor sano no cabía [ia]

Medido con las keys del ws1: Gemini 403 (Google bloqueó el proyecto de la key, que es la misma de la
plataforma) y 429; OpenRouter 404 (el modelo gratis ya no es gratis); Mistral 429 siempre; OpenAI 429
sin crédito. Groq armaba un flujo válido en 3 s y la cascada nunca lo probaba: `maxTokens` CUENTA para
el techo de entrada, y 4k de prompt + 6k de salida pasaban los 7k. Se achicó el contexto (claves
cortas para los disparadores, topes al perfil) y la salida se calcula para que entre (`salidaParaIA`).
⚠️ El mensaje culpaba a «la configuración de MaKo» porque clasificaba todos los errores juntos: ahora
es por proveedor (`falloDeIA`). Los demás callers de `errorDeCascada` siguen con el defecto.

**Vive en:** `lib/flujo-ia.ts` · `app/api/chat-agent/secuencias/ia/route.ts` · `lib/ai-cheap.ts` (`techoDeEntrada`)

### El email en HTML: las variables se resuelven POR CONTEXTO dentro del saneo [mensajes]

El cuerpo del email es el editor rico de las lecciones y el paso guarda `cuerpo_html` saneado con
lista blanca (`lib/email-html-seguro.ts`). Un `{{nombre}}` adentro de un href (`?n={{lead_nombre}}`)
con «Ana Pérez» rompía el link: en el texto va escapado, en un href/src codificado, y la URL se valida
DESPUÉS de reemplazar. Sin imágenes subidas: falta un almacenamiento público.

**Vive en:** `lib/email-html-seguro.ts` · `lib/email-html.ts` · `app/chatbot/EditorEmailGmail.tsx` · `lib/nutricion.ts` (envío)

### Una fila optimista es un estado aparte, y se sigue por una clave estable [lista]

La fila de «＋ Nueva» que aparece al instante desaparecía a mitad de la creación y la selección se
perdía al llegar el id real. Va calculada sobre la lista del server (`creando:<temporal>`), aplicada al
dibujar. Y «Duplicar» no copia la fila entera: inserta una pausada con lista blanca de columnas y cada
campo con puerta propia pasa por su puerta (pasos → setSecuenciaPasos).

**Vive en:** `app/chatbot/SimuladorWhatsApp.tsx` · `app/chatbot/ChatAgentApp.tsx` · `lib/secuencia-duplicar.ts`

### Un cambio de contrato de una parte deja «verde por aire» el test de otra [integración]

Al sacar «Eventos» del CRON, el test de presupuesto de Crear con IA siguió en verde con sus roturas: el
negocio de prueba pesaba 40 eventos y ya no medía el borde. Un test de presupuesto se calibra CERCA del
borde, con la medición escrita, y se re-prueba rompiéndolo cuando cambia lo que mide. Y una función
que alimenta una pantalla y otro lector no se reforma para la pantalla: se agrega la forma nueva al
lado (el CRON por pasos dejaba a Crear con IA sin disparadores).

**Vive en:** `tests/flujo-ia*.test.ts` · `lib/flujo-conversacion.ts` (`seccionesDisparo`)


## La cuarta tanda (09/10/2026, a medias): «Probar» que no mostraba nada, y sacar sin romper lo prendido

Pedido literal en la bitácora (9 oct 11:02); decisiones en docs/chatbot-flujo-ramas-diseno.md →
«CUARTA TANDA». Se hizo una parte, directo y en pasos chicos (la cuenta en 92-93 %): lo que falta,
por número de punto, en `docs/relevo/chatbot.md`.

### «Le di a probar y no salieron los mensajes»: no era el envío, era una puerta del simulador [probar]

El diagnóstico obvio era que la prueba no mandaba. Lo que pasaba: el simulador FRENABA en cada
condición esperando que alguien eligiera la rama con los botones («Llegó hace menos de 3 días /
Si no»), y con una condición como primera tarjeta no salía ningún mensaje. Ahora sigue sola por la
primera rama (el «Sí»). La regla: una prueba que arranca sola no puede quedarse esperando una
decisión que nadie le pidió a quien mira; si hace falta probar la otra rama, eso es un control
aparte, no un freno.

⚠️ **Y «siempre por el Sí» fue el arreglo equivocado** (quinta tanda): cambió el freno por un desvío.
Ver «"Probar" por el "Sí" también escondía los mensajes», más abajo: la decide el motor con un lead
recién llegado.

**Vive en:** `app/chatbot/PanelProbar.tsx` (el `case 'condicion'`)

### Sacar un tipo de tarjeta del producto = dejar de OFRECERLO, no dejar de dibujarlo [lienzo]

Martín pidió sacar REPLY, GO TO, «Si responde» del CRON, «antes de la reunión» del DELAY y
condiciones que el CRM no registra. Varias secuencias PRENDIDAS los usan (las convertidas de la
primera tanda tienen «Si responde»). Sacarlos del dibujo habría cambiado qué hace hoy una secuencia
sin que nadie lo viera. Se sacan de lo que se OFRECE (el ＋, el desplegable, el catálogo con
`retirada`, `FUERA_DEL_SELECTOR`) y lo que ya existe se sigue dibujando, corriendo y borrando. La
migración de esas secuencias a lo nuevo es una decisión aparte.

**Vive en:** `lib/flujo-conversacion.ts` (`opcionesDelMas`, la tarjeta CRON) · `lib/condiciones-catalogo.ts` (`retirada`, `seOfrece`) · `lib/editor-acciones.ts` (`FUERA_DEL_SELECTOR`) · `app/chatbot/FlujoLienzo.tsx` (`EditorEspera`)

### El desplegable de la casa no es un `<select>`: lo puesto que no está en la lista lo dice el botón [cron]

«La que tiene puesta» existía por la regla del `<select>` cuyo valor no está entre sus opciones
(muestra la primera y el primer clic la pisa). El `Dropdown` de la casa no tiene esa trampa: el botón
dibuja `botonLabel` (`rotuloDisparo` cae a `textoActual`) y nada se escribe hasta elegir. Esa sección
era ruido, y Martín la vio como tal. La regla del `<select>` sigue valiendo para un `<select>` nativo.

**Vive en:** `lib/flujo-conversacion.ts` (`pasosDisparo`, `rotuloDisparo`)

### `echo tsc=$?` después de un pipe mide el `tail`, no el typecheck [proceso]

`npx tsc --noEmit | tail -15; echo tsc=$?` imprime el exit del `tail` (0), y un commit salió con un
error de tipos que el mismo comando mostraba arriba. Se cazó en el paso siguiente, sin pushear. El
chequeo va a un archivo y el `$?` del comando: `npx tsc --noEmit > out.txt 2>&1; echo $?`.

### El «De» del email: hoy hay UN remitente por negocio, y «Vincular nuevo» lo REEMPLAZA [email]

Martín pidió elegir el remitente «si se tiene vinculado varios email, con el botón de vincular
nuevo». Medido: un workspace tiene UN remitente (`getEmailFrom`: `resend_from` → `RESEND_FROM` → el
sandbox), «Guardar remitente» de /email lo PISA, y de los 11 workspaces sólo el ws1 tiene
`resend_from` (y es «MaKo <equipo@hola-mako.com>»). No existe una lista de remitentes en ningún lado.

Lo hecho sin inventar un modelo: el «De» lista lo que hay (`remitentesVinculados` ya lee un
`remitentes` si la ruta algún día lo manda) y «Vincular nuevo» monta el MISMO `DominioSetup` de
/email en un modal. Como el rótulo promete SUMAR y ese botón pisa el «De» de todos los emails del
negocio (los pasos sin remitente propio y los broadcasts), el modal lo dice arriba cuando ya hay uno
(«Reemplaza el remitente de tu negocio.»). El paso guarda `remitente` sólo si no es el del workspace,
y el motor lo usa sólo si es del MISMO dominio (`remitenteDelPaso`): la cuenta de Resend es una para
todos los clientes, así que sin esa guarda un paso guardado con el mail de otro cliente saldría.

**Regla:** mudar a un botón cercano una acción que pisa algo COMPARTIDO le cambia los supuestos de
frecuencia (AGENTS.md); el lugar nuevo nombra lo que pisa. Sumar de verdad es un dato nuevo (varios
remitentes por negocio) y lo decide Martín.

**Vive en:** `lib/email-remitente.ts` · `app/chatbot/EditorEmailGmail.tsx` (`VincularRemitente`,
`AVISO_REEMPLAZA`) · `app/email/EmailApp.tsx` (`DominioSetup`) · `lib/nutricion.ts` (envío y
`setSecuenciaPasos`)

### Una prop nueva del editor con CERO call sites: el «De» se guardaba y no se veía [email]

`EditorEmailGmail` acepta `remitente` y sus tests lo prueban montándolo a mano, pero quien lo monta
en el lienzo (`EditorEmail`, `app/chatbot/FlujoLienzo.tsx`, de otra parte de la tanda) no se lo pasa:
elegir otro remitente lo GUARDABA en el paso y la pantalla seguía diciendo el del workspace. Es
«escribir la salida no es ofrecerla» con la forma del reparto por archivo: la capacidad en un
archivo y el enchufe en otro que la parte no podía tocar. Se enchufó al unir la tanda, y lo fija
`tests/chatbot-enchufes.test.ts`.

**Vive en:** `app/chatbot/FlujoLienzo.tsx` (`EditorEmail`)

### El modo HTML: lo que el editor visual no sabe dibujar SALE, y se simplifica al volver a escribir [email]

La caja HTML pasa cada tecla por la misma lista blanca (`sanearHtmlEmail`) y lo saneado llega al
paso tal cual, incluido lo que el editor rico no tiene en su esquema (un `h1`, `sub`/`sup`, un
`colspan`): eso sale en el mail. Al volver al modo visual el editor carga ese HTML con SU esquema, y
la próxima tecla guarda lo que el editor dibuja, o sea la versión simplificada. No se midió con clics:
sale de cómo carga ProseMirror un documento. Si un cliente arma un mail en HTML y después toca una
coma en el visual, pierde lo que el visual no sabe dibujar.

**Vive en:** `app/chatbot/EditorEmailGmail.tsx` (`alCambiarCrudo`, `salirHtml`) · `app/_ui/EditorRico.tsx`

## Cuarta tanda punto 1 y quinta punto 3 (09/10/2026, parte «editores»): el panel por tipo y el DELAY con segundos

Pedido literal: «No me gusta que el editor del CRON como muchos otros tengan tanto espacio en blanco y
un desplegable chico arriba del todo» y «En Delay, falta la opción de minutos y segundos...». Rama
`wip-v4-editores`; una corrida la empezó y la cuota la cortó, la segunda la verificó contra el pedido
y cerró lo que faltaba.

### «Segundos» que no eran segundos: el diagnóstico obvio (la precisión del cron) era la mitad [motor]

La primera corrida resolvió la precisión como había que resolverla —una espera de hasta 120 s se
cumple DURMIENDO adentro de la corrida (`dormirEsperaCorta`), con su tope y sus tests— y la pantalla
no avisaba nada para ≤ 120 s, o sea prometía exactitud. Medido después, en tres lugares:

- **La ruta del cron nunca le pasaba el tope** (`esperarHastaMs`): `procesarEnvios` sin tope no duerme
  (a propósito), así que el dormir era una capacidad con CERO call sites. Los tests leían el motor y
  daban verde; nadie miraba la ruta.
- **El caso típico no pasa por el cron**: «Nuevo lead → esperar 30 s → WhatsApp» corre por la VÍA
  RÁPIDA del evento (`enrolarPorEvento` / `inscribirEnSecuencia` → `procesarEnvios({ soloLeadId })`),
  adentro de un webhook que tiene que contestar ya. Ahí no se puede dormir, y los 30 s eran «la corrida
  de la hora siguiente». Va con `after()` de Next: contesta y DESPUÉS duerme lo que falta y vuelve a
  correr ese lead con tope (`seguirDespuesDeResponder`), en fila por proceso para no correr 30 motores
  a la vez sobre los topes. Si `after` no está o la función muere, la fila ya tiene la hora exacta y la
  toma el cron: tarde, nunca perdida.
- **La píldora y «Probar» redondeaban a minutos** (`textoEspera`, lib/flujo-grafo.ts): 10 s se
  dibujaba «Esperar 0 min» y 30 s «Esperar 1 min», con el editor diciendo «10 segundos» al lado. El
  commit decía que estaba hecho y el test probaba `textoDuracion`, no a quien la tenía que llamar.

La regla: **una capacidad del motor que depende de un parámetro se verifica en el que lo PASA**, y
«¿quién llega a este nodo?» se contesta enumerando las ejecuciones que lo alcanzan (acá: el cron y la
vía rápida), no la que uno tenía en la cabeza.

**Vive en:** `lib/espera-duracion.ts` (la decisión entera, en la cabecera) · `lib/nutricion.ts` (`procesarEnvios`, `seguirDespuesDeResponder`) · `app/api/cron/nutricion/route.ts` · `lib/flujo-grafo.ts` (`textoEspera`)

### Un DELAY corto entre dos WhatsApp no existe: lo frena el anti-ban de 20 h, no la espera [motor]

El ejemplo con que se pensó la feature («audio y 10 s después el link») no puede pasar con ningún
DELAY: el segundo WhatsApp al mismo lead cae en `frenadoPorAntiBan` (20 h por canal; 3 h con reunión
en menos de 48 h) y no avanza. Un DELAY de segundos sirve entre el CRON y el primer mensaje, o entre un
mensaje y una acción, un email o un aviso al grupo. Dos mensajes seguidos de WhatsApp son UNA tarjeta
con varias burbujas (cuarta tanda, punto 15). La pantalla del DELAY no lo dice: el aviso es de la
espera, no del anti-ban.

**Vive en:** `lib/nutricion-grafo-motor.ts` (`frenadoPorAntiBan`) · `lib/nutricion.ts` (`HS_MIN_ENTRE_MSGS`)

### «Puede salir hasta 1 h después» era falso dos tercios del día: el cron corre de 15 a 23 UTC [motor, ui]

`"0 15-23 * * *"` son nueve corridas, de 9 a 17 en Ciudad de México. Una espera que vence a las
17:30 de ahí sigue a las 9 del día siguiente, y eso vale también para «Esperar 2 horas» y «1 día»,
que no llevaban aviso («una hora de más sobre un día no cambia nada» — de noche son 16). El aviso
pasó a decir CUÁNDO sigue, con las horas de quien mira y para toda espera de más de 120 s: «Sigue a
la hora en punto (9 a 17 h)». Las horas y la cadencia las fija un test leyendo vercel.json.

Y de rebote: entre las 17 y las 21 de Ciudad de México la ventana horaria del motor deja mandar y no
hay ninguna corrida — lo que vence en esa franja espera a la mañana (sólo lo dispara al momento un
evento nuevo, por la vía rápida). Decide Martín: ampliar el cron cambia cuántas veces por día se
aplica el tope «por corrida».

**Vive en:** `vercel.json` · `lib/espera-duracion.ts` (`HORAS_MOTOR_UTC`, `avisoDePrecision`)

### El panel mide por TIPO de tarjeta, y el selector es el campo grande de la casa [lienzo]

Todos los editores medían lo del de WhatsApp (~720 × 420): un DELAY era una frase arriba y el resto
vacío. `editorDeTarjeta` (lib/lienzo-grafo.ts) decide alto y ancho por el TIPO —nunca por el contenido
de cada render: lo que no entra scrollea adentro—: DELAY, TAG y GO TO 140; MAKO 280; CONDITION y CRON
320; ACTION y «Si responde» 400; un mensaje, el grande (840 × 560). `campoGrande` / `botonGrande`
(48 de alto, letra 16) en DELAY, TAG, ACTION y GO TO. Lo que queda raro: el CRON usa su propio
`BOTON_CAMPO_CRON` (44, letra 14,5) —dos «campos grandes» que difieren es el olor de dos piezas
separándose— y con horario mensual o anual su contenido pasa los 320 y scrollea.

**Vive en:** `lib/lienzo-grafo.ts` (`editorDeTarjeta`, `ALTO_EDITOR_CONTROL`) · `app/_components/Lienzo.tsx` (`campoGrande`, `botonGrande`, `altoFijo`) · `app/chatbot/SecuenciaPerfil.tsx` (`BOTON_CAMPO_CRON`)

## Lo que quedó sin hacer

**De la parte «editores» (cuarta 1 + quinta 3, 09/10/2026):**

- **Medir la espera corta en producción.** Lo que corre después de contestar vive lo que el
  `maxDuration` de la ruta que llamó a la vía rápida (webhooks, server actions): no se midió cuánto es
  en cada una. Si muere, sale con el cron (la hora exacta ya está en la fila). `lib/nutricion.ts`
- **De 2 a 59 min sigue dependiendo del cron**: si Martín quiere minutos exactos, hace falta un tick
  frecuente SÓLO para las filas que salen de una espera (el de `flujo-corridas` corre cada 5 min), sin
  multiplicar el tope «por corrida». Y la franja 15-23 UTC deja sin corrida de 17 a 21 de México.
- `BOTON_CAMPO_CRON` (44 / 14,5) contra `botonGrande` (48 / 16): unificar. `app/chatbot/SecuenciaPerfil.tsx`
  (lo fija `tests/cron-varias-etapas.test.ts`).
- El selector de la CONDITION sigue siendo el `Dropdown` de fila. `app/chatbot/EditorCondicion.tsx`
- Verlo con clics: el panel por tipo, el DELAY con «10 segundos» y su aviso, y una espera de 30 s de
  un lead nuevo de verdad.

## Cuarta tanda, punto 15, y quinta, punto 1 (09/10/2026): varios mensajes por tarjeta y «Probar» como un lead nuevo

### «Probar» por el «Sí» también escondía los mensajes: la causa no era la espera [probar]

Síntoma (quinta tanda, punto 1): «al darle probar en la automatización de bienvenida, no salió el
mensaje que debería salir… si es por el delay, evidentemente no debe tardar nada». El diagnóstico
obvio era la espera de 1 h, y era el equivocado: la prueba ya no espera (la píldora se dice y se
sigue). MEDIDO con la Bienvenida del ws1 (`docs/relevo/chatbot-secuencias.json`, M2) y la regla de la
cuarta tanda: «Esperar 1 h» → el «Sí» de «Agendó» → «↪ Sigue en «Agendó: confirmar y preparar»», y
ningún mensaje. El arreglo de la entrada de arriba («sigue sola por el Sí») cambió el freno por un
desvío: toda condición del tipo «si ya agendó, mandalo a otra automatización» se comía el flujo.

La regla: **una prueba que decide sola decide como el MOTOR, con un lead que acaba de entrar por ese
CRON** (sin agenda, sin pago, sin respuestas, llegado ahora, con la etapa o la etiqueta por la que
entró), y lo que la prueba misma produjo también cuenta (después de un mensaje, «ya le escribimos»).
Con la MISMA función que el motor (`elegirSalida`). Y el bloque `catalogo` de ese lead va con CEROS,
no ausente: ausente, una condición negada del catálogo («No reprodujo el VSL») nunca se cumple, y la
prueba seguiría por el «Si no» de algo que un lead nuevo sí cumple.

**Vive en:** `lib/simulador-grafo.ts` (`hechosDeLeadNuevo`, `leadNuevoDelCron`, `elegirComoLead`) · `app/chatbot/PanelProbar.tsx` (el `case 'condicion'`) · `tests/probar-lead-nuevo.test.ts`

### Un dato que pasa a vivir en DOS lugares rompe a quien pregunta «¿quién usa esto?» [modelo]

Un mensaje de varias partes guarda la primera en los campos de siempre (`cuerpo`, `audio_id`,
`media_id`: el espejo) y el resto en `partes`. El barrido de AGENTS.md («antes de sumar un tipo de
paso, `grep` de `.pasos` y de `setSecuenciaPasos`») encontró a los que leían sólo el espejo, y el caso
caro no recorre pasos: PREGUNTA por un id. `pasosUsanAdjunto` (biblioteca) y `borrar_audio` (API)
miraban `media_id` / `audio_id` del paso, así que el archivo o el audio de la SEGUNDA parte se podía
borrar y el motor fallaba en cada lead cada 24 h, sin que nadie lo viera (`enviarPartesDelPaso` baja
todo antes de mandar y no manda nada). Los otros: el generador de copy le pedía texto al modelo para
el espejo (un audio con cuerpo vacío) y ese texto entraba como una parte MÁS; las variantes se
generaban —y se pagaban— para que el guardado las tirara; la prueba de la API mandaba sólo la primera
parte (y un audio sin su pie, que el motor sí manda); la ficha de la API y el contexto de MaKo leían
sólo el espejo.

La regla: **al partir un dato en espejo + resto, se buscan también los lectores del ID (`audio_id ===`,
`media_id ===`), no sólo los que recorren la lista**, y la pregunta «¿lo usa?» va en UNA función
(`pasoUsaAudio`, `pasoUsaArchivo`).

**Vive en:** `lib/mensaje-partes.ts` · `lib/setting-adjuntos-reglas.ts` (`pasosUsanAdjunto`) · `lib/api-mako/areas/chatbot.run.ts` (`borrar_audio`, la ficha) · `lib/nutricion-generator.ts` · `lib/secuencias-variantes.ts` · `lib/setting-secuencias.ts` (`probarSecuencia`) · `lib/mako-context.ts` · `tests/partes-recorren.test.ts`

### Los destinos de «Probar» se guardan, y son de la PERSONA [probar]

Pedido: «primero el desplegable me debe ofrecer los números que ya tiene guardado, y abajo un botón de
"Nuevo número"». Hasta acá la regla era «el destino NO se guarda» (lienzo-3: precargar el contacto de
reportes del NEGOCIO le mandaba la prueba al cliente). Lo que se guarda ahora es de QUIEN PRUEBA: su
teléfono y su email de siempre, y los que fue escribiendo como «Nuevo número», en `usuarios.perfil.
destinosPrueba` de SU fila (por el email de su sesión, nunca «viendo como cliente»), reescribiendo el
jsonb desde lo que ya tenía (ahí viven el formulario y `notifInApp`). Nunca los destinatarios del
workspace: con el super admin mirando a un cliente, ofrecer los números del cliente es un clic de
distancia de mandarle la prueba a él.

**Vive en:** `lib/simulador-grafo.ts` (`destinosGuardados`, `perfilConDestino`) · `lib/prueba-paso.ts` (`guardarDestinoDeQuienPrueba`) · `app/api/chat-agent/simulador/route.ts` (`guardar-destino`) · `app/chatbot/PanelProbar.tsx` (`MenuDestinos`)

## Quinta tanda punto 2 (09/10/2026, parte «lienzo»): el ＋ en toda la flecha y las tarjetas que se mueven

### `vector-effect: non-scaling-stroke` NO corrige un zoom de CSS: el diagnóstico obvio era el equivocado [lienzo]

El ＋ de una flecha sólo aparecía en un cuadrado invisible de 28 px en el medio. La cura que proponía
el relevo —una franja invisible a lo largo del trazo con `non-scaling-stroke`— medida en Chrome al 40%
daba **6,5 px**, igual que sin el efecto: Chromium calcula el trazo «que no escala» sólo con las
transformaciones de ADENTRO del `<svg>`, y el zoom del lienzo es un `scale()` sobre la capa HTML. Lo que
anda es dividir el ancho por el zoom (16,5 px a cualquier escala). El ＋ además tarda 350 ms en apagarse,
para poder llegar a él en línea recta aunque la curva se salga de la franja. Ya está en AGENTS.md, en la
regla de las capas con `scale(k)`.

**Vive en:** `app/_components/Lienzo.tsx` (`TOQUE_FLECHA`)

### Mover una tarjeta: tres trampas que no se ven en el handler [lienzo]

- **Soltar deshacía el paneo.** Al mover una tarjeta el dibujo cambia de tamaño, cambia la firma del
  encuadre y la vista se re-centraba sola. Afectaba también a /mensajes. `trasMover` lo evita.
- **Mover sólo la tarjeta dejaba atrás sus salidas y sus ＋**, y las flechas se despegaban. Se arrastra el
  ENVOLTORIO de la tarjeta y las flechas se recalculan con la misma curva.
- **«No pude leer las posiciones» no es «no hay ninguna».** Un mapa que arrancó vacío por una lectura
  caída y se guarda al soltar pisa todo lo que la persona ya había acomodado: con la lectura fallida no se
  guarda nada. Y si falta la columna (la 0233 sin aplicar), las tarjetas se mueven y no se guardan, sin
  error (42703 / PGRST204 se distinguen de otros fallos).

Las posiciones son DESPLAZAMIENTOS desde donde el árbol pone el CRON (lo que no se movió se dibuja como
antes), viven en `nutricion_secuencias.posiciones` —nunca en `pasos`, que pasan por un saneo campo por
campo— y se guardan por su propia acción, sin pasar por Publicar ni por la pila de deshacer.

**Vive en:** `lib/lienzo-posiciones.ts` · `lib/secuencia-posiciones.ts` · `app/chatbot/usePosicionesLienzo.ts` ·
`app/_components/Lienzo.tsx` (`trasMover`) · `supabase/migrations/0233_secuencia_posiciones.sql`

### Proceso: lo que costó verificarlo con clics en un worktree [proceso]

`next dev --webpack` no compila (`node:crypto`); Turbopack en un worktree sólo anda con `turbopack.root`
apuntando a la carpeta de arriba (se cambia y se restaura sin diff); la primera compilación de /chatbot
tardó 4,6 min; matar un `npm test` en curso deja 218 falsos rojos «The service was stopped»; y el número
de migración se ocupó DOS veces mientras se trabajaba (0231 y 0232): se mira justo antes de commitear.
Y el agente dejó el `next dev` prendido al terminar: quien une la tanda revisa los procesos.

## Sexta tanda, parte «modelo» (09/10/2026, noche): varias flechas a una tarjeta, sueltas, «Si responde» como CONDITION, sin GO TO

Las decisiones y los contratos, en [chatbot-flujo-ramas-diseno.md](chatbot-flujo-ramas-diseno.md) →
«SEXTA TANDA, parte «modelo»». Acá, lo que costó.

### «No puedo abrir 2 flechas después de una condición» era el TOPE DE CAMINOS sumando de más [modelo]

**Síntoma:** Martín, punto 13: «Aún no funciona poner o sacar más de una flecha a una tarjeta... si
quiero luego de una condición abrir 2 flechas. Debería poderse».

**El diagnóstico obvio era el equivocado:** que el lienzo no ofrecía el ＋ en paralelo en un resultado,
o que el motor no corría los paralelos. El motor, «Probar» y `validarGrafo` los corrían bien. La causa
real eran DOS: (1) `validarGrafo` rechazaba «la tarjeta X cuelga de N lugares» y no había ninguna
edición para conectar a una tarjeta que ya existe; (2) el tope de caminos (`TOPE_HILOS` = 6) se medía
con la SUMA de todas las flechas en paralelo, también las de los DOS resultados de cada condición,
aunque para un lead corre uno solo. Con tres condiciones con una flecha en el «Sí» y otra en el «Si
no» eran 1 + 6 = 7 «caminos»: la tercera ya no podía sacar su segunda flecha. Y como el lienzo
pregunta con la misma función qué ofrecer, el botón tampoco aparecía — se leía como un botón que falta.

**La regla:** un tope sobre «lo que corre a la vez» se calcula sobre lo que CORRE: en ramas que se
excluyen es el MÁXIMO, nunca la suma (`contarParalelos`, la suma quedó en `totalDeParalelos`). Y cuando
un número decide a la vez lo que se OFRECE y lo que se RECHAZA, un número inflado se ve como un botón
que no está, no como un error.

**Vive en:** `lib/flujo-grafo.ts` (`contarParalelos`, `reglasDeHilos`)

### Sacar «un padre por tarjeta» rompía en silencio a cuatro lectores que subían por `padreDe` [modelo]

**Síntoma (en la revisión, no en pantalla):** con varios padres permitidos, tres ayudantes del motor
seguían subiendo por UN padre: `esPrimerPaso` (¿es la bienvenida? — decide si se vuelve a mirar el tope
de antigüedad), `minutosAntesDeReunion` (¿es un recordatorio? — sin eso sale «Mañana es tu reunión» sin
reunión) y `mensajeAnteriorDe` (qué borrador espera una acción). Y `borrarNodo` reconectaba sólo al
primer padre: los demás quedaban apuntando a la nada.

**Causa real:** relajar un invariante estructural (de árbol a grafo con ciclos) no rompe a quien lo
declaró; rompe a quien lo ASUMÍA, que es otro archivo y no falla: elige un padre y sigue.

**La regla:** al aflojar un invariante, `grep` de cada lector del supuesto (`padreDe`) y una decisión
por lector: «por TODOS los padres» (`padresDe`) o «sin la flecha que vuelve» (`padresSinVuelta`, con
`aristasDeVuelta`: la flecha de un «volver al principio» no es «lo de antes» — sin sacarla, la
bienvenida de un bucle dejaba de ser la primera). Lo fijan `tests/flujo-sexta-modelo.test.ts` (M6, M9,
M10, M13 de sus roturas).

**Vive en:** `lib/nutricion-grafo-motor.ts` · `lib/nutricion-hilos.ts` · `lib/flujo-grafo.ts` (`borrarNodo`, `soloDe`)

### Una tarjeta suelta conectada a la primera se volvía la ENTRADA [modelo]

**Síntoma (medido con el modelo, antes de dibujar):** conectar una suelta a la primera tarjeta dejaba
a la suelta como raíz: el CRON le iba a escribir al lead lo que la persona dejó a un costado.

**El diagnóstico obvio era el equivocado:** «que `normalizar` fije la raíz». `normalizar` no sabe
cuál era la raíz ANTES de la edición; cuando corre, la primera ya está apuntada. **Causa real:** sin el
nodo `inicio` en el dato, la raíz se DEDUCE («la primera tarjeta que nadie apunta»), y con tarjetas
sueltas esa deducción deja de alcanzar.

**La regla:** toda edición de flechas fija la raíz ANTES (`fijarRaiz`: el CRON como dato, al final del
array para no correr ningún `paso_actual`). Y «volver al principio» con una flecha dejaba la primera
apuntada y `raizSalida` sin raíz: si todo lo que la apunta cuelga de ella misma, sigue siendo la raíz.

**Vive en:** `lib/flujo-grafo.ts` (`fijarRaiz`, `raizSalida`, `conectar`, `desconectar`, `crearSuelta`)

### Un ciclo ya no lo arma sólo un «Ir a»; y el «Ir a» que retoma desde «Si responde» no es un cruce [modelo]

**Síntoma:** con flechas que vuelven, la regla «el «Ir a» X vuelve atrás sin espera» no veía un ciclo
armado con flechas. Y la primera versión de `cruces` marcaba como «dos caminos a la vez» el «Ir a» que
retoma la salida desde «Si responde» (5 rojos en tests viejos).

**Causa real:** el retome no es un camino más: el motor descarta los congelados y sigue UNO. Y los
resultados de una condición se excluyen: dos llegadas sólo chocan si no tomaron resultados distintos
en ninguna condición que compartan (`ctx`).

**La regla:** los ciclos se buscan en el grafo de EJECUCIÓN sin las esperas (`ciclosSinEspera`); un
cruce se juzga con el contexto de qué resultado tomó cada llegada. El texto viejo «…de «Ir a»» queda
sólo si el bucle tiene un «Ir a»: `tests/lienzo-capas.test.ts` mira el texto exacto, y nombrar algo que
ya no existe no dice qué pasó.

**Vive en:** `lib/flujo-grafo.ts` (`ciclosSinEspera`, `cruces`, `llegadasPorTarjeta`)

### No había borrador: una automatización a medias no sobrevivía a una recarga [modelo]

**Medido:** lo único que escribía los pasos era Publicar (PATCH /api/whatsapp/secuencias →
`setSecuenciaPasos` → `validarGrafo`). El lienzo editaba en memoria. «Que quede flotando» era imposible
de guardar.

**La trampa al hacer el borrador:** se abre sólo si se armó sobre lo publicado de hoy, y la huella
(`firmaPublicado`) tiene que ser el MISMO cálculo de los dos lados —ordenado por `orden`, normalizado y
renumerado, como lo publica `setSecuenciaPasos` y lo carga el lienzo—. Con una diferencia en el orden,
ningún borrador se abriría nunca, sin un error (rotura B3).

**La regla:** lo incompleto se GUARDA con `validarParaGuardar` y se PUBLICA con `validarGrafo`; el
motor no lee `pasos_borrador` nunca (lo fija un guard que barre los tres módulos del motor).

**Vive en:** `lib/secuencia-borrador.ts` · `supabase/migrations/0240_secuencia_borrador.sql`

### «Si responde» como CONDITION: convertir el dato era el camino caro [modelo]

**El diagnóstico obvio:** pasar el nodo `respuesta` a `nodo: 'condicion'` con una fila nueva. **Por qué
no:** #212 y #213 (ws1, un cliente) corren en vivo con ese nodo, y una respuesta nunca PASA por una
tarjeta de la salida: la pausa y entra por `responderConGrafo`. Convertir obligaba a reescribir ese
camino y reubicar inscripciones. Se dibuja y se edita como condición sobre el mismo motor (la familia
«Respuesta» del catálogo con `evento: 'respuesta'`, que no se ofrece en la salida y cuyo `evaluar` dice
«no sé»). Una fila «Su respuesta trata de» puesta a mano en una condición de la salida no se guarda.

**Vive en:** `lib/condiciones-catalogo.ts` (`respuesta_trata_de`, `seOfrece`) · `lib/flujo-grafo.ts` (`condicionARespuesta`) · `app/chatbot/EditorCondicion.tsx` (`EditorCondicionDeRespuesta`)

### GO TO: lo medido en producción y la red de `abrirFlujo` [modelo]

**Medido (09/10/2026, `scripts/quitar-ir-a.mts --simular --con-archivadas`, sólo lectura):** de 69
automatizaciones, tres con «Ir a»: #198 (activa, dos «Sigue en #212»; a #212 la dispara su CRON), #221
(pausada, un salto que vuelve a la espera de arriba → flecha) y #222 (archivada, tres «Sigue en #221»,
que está pausada: por el salto tampoco entraba nadie). Cero inscripciones paradas en un «Ir a»; cero
riesgos. `--aplicar` no se corrió.

**La trampa:** `erroresNuevos` compara TEXTOS de error, y sacar un «Ir a» cambia el texto de un error
que ya estaba («…dentro de un bucle de «Ir a»» → «…dentro de un bucle»): una automatización que ya no
se podía publicar contaba como «la conversión la rompe» y el lienzo la habría abierto CON el GO TO. Lo
de antes vuelve sólo si se podía publicar y convertido no (no pasa en ninguna de las tres: es la red).

**Vive en:** `lib/flujo-legado.ts` (`quitarIrA`, `abrirFlujo`) · `scripts/quitar-ir-a.mts`

### Trampas del entorno de esta corrida [modelo]

- **El scratchpad de la sesión es COMPARTIDO por las ocho partes en paralelo** (había `parte-lienzo/`,
  `editores-v6/`, un `romper.mjs` ajeno): es la regla de `/tmp` un nivel más adentro. Cada parte usa
  una subcarpeta propia, o el `commit -F` de una lee el mensaje de otra.
- **Python en Windows escribe CRLF en modo texto**: un `.ts` creado en LF y editado con `open().write()`
  queda CRLF entero (parejo, no mezclado). Y un arnés de roturas cuyo «de» viene de un JSON con `\n` no
  encuentra nada en un archivo CRLF: el arnés tiene que pasar sus anclas al salto del archivo.
- **Un script no puede importar el catálogo de CRON** (`TRIGGERS`, `lib/email-marketing.ts`): arrastra
  `lib/workspace.ts`, que es `server-only`. El script imprime el `trigger_tipo` crudo; copiar la lista
  sería un segundo catálogo.

### Lo que quedó sin hacer (parte «modelo»)

- **El cableado, que es de otras partes** (las líneas exactas van en el reporte de la corrida):
  `SecuenciaPerfil` abre con `abrirFlujo` y guarda el borrador; la ruta POST
  `/api/chat-agent/secuencias` con `action: 'borrador'`; el GET lee `leerBorradoresSecuencias`; el
  `EditorDeNodo` pasa `onPasarARespuesta`; `lib/flujo-conversacion.ts` dibuja `respuesta` como
  CONDITION; `lib/flujo-edicion.ts` edita por `conectar` / `desconectar` / `crearSuelta`.
- **Aplicar la 0240 ANTES del deploy** (tolera su ausencia: sin columna no hay borrador).
- **`scripts/quitar-ir-a.mts --aplicar`**: lo decide Martín. Sin correrlo, el lienzo abre igual sin GO TO
  y Publicar guarda lo convertido.
- **El plazo de una respuesta** («si responde en N horas») no existe en el motor. `lib/nutricion.ts`
- **Verlo con clics**: nada de esta parte se vio en un navegador.
## Sexta tanda (09/10/2026, parte «lienzo»): «Entonces», arrastrar flechas, sueltas, el DELAY en la flecha y el click derecho

Pedido literal en la bitácora (9 oct 18:37), General 2-8, 13 y 14, CRON 10 y DELAY 1. Las ediciones
del mouse viven en `lib/flujo-edicion.ts` (puro, con test); el lienzo las dibuja.

### El CRON implícito convierte «queda flotando» en «pasa a colgar del CRON» [lienzo]

**Síntoma (en los tests, antes de la pantalla):** borrar la primera tarjeta hacía que la de después
quedara conectada al CRON sola; y conectar una suelta a la primera hacía que la SUELTA pasara a ser la
salida (CRON → suelta → primera).

**Causa:** sin nodo de inicio, la salida es «la primera tarjeta que nadie apunta, en el orden del array»
(`raizSalida`). Toda edición que cambia quién no tiene padre puede cambiar la raíz sin que nadie la toque.
⚠️ El diagnóstico obvio («la suelta tiene que ir al final del array») es la mitad: un hijo que pierde a su
padre puede estar ANTES de la raíz en el array, y se la gana igual.

**Regla:** una edición que puede cambiar «la primera» deja la flecha del CRON EXPLÍCITA (`conRaiz`: el
inicio `'entrada'` con la raíz de antes) — sólo cuando hace falta, así un flujo que nadie desconectó
queda igual byte a byte. Romperlo tumba 4 de 16 tests.

**Vive en:** `lib/flujo-edicion.ts` (`conRaiz`) · `tests/flujo-edicion.test.ts`

### Sacar la regla de «dos padres» abre una puerta que no es de dibujo: dos hilos que se juntan [modelo, lienzo]

**Síntoma:** CRON → m1 → m2 con e1 en paralelo; conectar e1 a m2 «se puede» y el lead recibe m2 DOS veces.

**Causa:** ⚠️ la regla «una tarjeta cuelga de un solo lugar» de `validarGrafo` parecía una restricción
del layout (un árbol) y era además la que impedía que dos hilos en paralelo alcanzaran la misma tarjeta:
el motor corre cada hilo por su cuenta (`aplicarAHilo`). Con varios padres (punto 13), juntar ramas de
una CONDICIÓN está bien (se excluyen: corre una) y juntar dos hilos en paralelo duplica envíos.

**Regla:** `conectar` rechaza juntar dos caminos en paralelo (`tarjetasDondeSeJuntan`; «Si responde» no
cuenta: retoma UN hilo). ⚠️ Pero `validarGrafo` también lo tiene que rechazar, o Crear con IA, la API o un
flujo viejo lo producen sin pasar por el lienzo: lo pedí a la parte del modelo.

**Vive en:** `lib/flujo-edicion.ts` (`tarjetasDondeSeJuntan`) · `lib/flujo-grafo.ts` (`validarGrafo`)

### Una espera sobre la flecha sigue siendo un NODO: la flecha del dato llega a ella, no a `hasta` [lienzo]

El DELAY del medio se dibuja como pastilla sobre la flecha padre → lo de después (`AristaFlujo.esperas`) y
no ocupa columna; en el dato sigue siendo un `esperar` con su `siguiente`. Quien borra o inserta sobre esa
flecha mira `esperas[0]`, no `hasta`: borrar la flecha se lleva sus esperas (eran de ella) y deja suelto lo
de después; eliminar la pastilla la SACA de la cadena (`borrarNodo`) y la flecha queda. Se aplasta sólo si
es un lugar de la flecha: un padre, una salida que sigue en algo y nada en paralelo; la del final, con dos
padres o que reparte sigue siendo su píldora. Lo que se pierde: una espera del medio ya no ofrece «＋ en
paralelo» desde ella (no tiene círculo).

**Vive en:** `lib/flujo-conversacion.ts` (`colapsable`, `tramo`) · `lib/lienzo-grafo.ts` (`posicionDePildora`, `puntoDeCurva`) · `app/chatbot/FlujoLienzo.tsx` (`quitarFlecha`, `borrarTarjeta`)

### El botón derecho armaba un gesto y SELECCIONABA la tarjeta debajo de su menú [lienzo]

`onPointerDown` no miraba el botón: con el click derecho capturaba el puntero y el `pointerup` lo
resolvía como un clic (abría el panel). El gesto de un lienzo se arma sólo con `e.button === 0`.

**Vive en:** `app/_components/Lienzo.tsx` (`onPointerDown`, `bajarCirculo`)

### El scratchpad NO es de la parte: es de la SESIÓN, y las ocho partes son la misma [proceso]

A mitad de la corrida, `msg1.txt` del scratchpad pasó a tener el mensaje de commit de OTRA parte («tiempo»).
Se salvó porque el commit ya había salido (verificado con `git log -1 --format=%B`). ⚠️ El diagnóstico
obvio —«el scratchpad es mío, la regla de `/tmp` no me toca»— es el equivocado: los subagentes de un
workflow comparten el directorio de su sesión, y los nombres que se le ocurren a uno (`msg1.txt`, `tc.txt`,
`correr-tests.mjs`) se le ocurren a todos. Cada parte trabaja en su subcarpeta (`scratchpad/parte-<nombre>/`).

### Verificado con clics (dev server del worktree, ws1, sólo lectura) [lienzo]

Playwright contra `next dev`, con una automatización de mentira inyectada en el GET de secuencias
(m1 → espera 1 h → m2, y m3 suelta) y TODO lo que no es GET contestado por el arnés: 0 llegaron al server.
Medido: el fondo con botón derecho ofrece 10 filas (los 7 tipos, Publicar, Acomodar, Centrar) y cierra con
Escape; la tarjeta, 3 (Duplicar, Desconectar, Eliminar) sin abrir el panel; un clic en el ＋ de m2 abre el
menú de 7 tipos en la punta (pegado al borde derecho de la ventana); arrastrando de m2 a m3 queda todo en
0,28 menos origen y destino (1) con la flecha siguiendo al cursor, y al soltar las flechas pasan de 2 a 3 y
m3 deja de estar suelta; la papelera de m1 se lleva la flecha y su espera (píldoras 1 → 0) y deja sueltas
m2 y m3 (m3 cuelga de una suelta, así que tampoco se alcanza).

⚠️ El ws3 no sirve para esto: rebota al onboarding GLOBAL (`/onboarding?ws=3`), y el arnés esperó el
lienzo 10 minutos en vez de fallar al ver la URL. Un arnés que espera un selector mira también `p.url()`.

### Lo que quedó sin hacer (parte «lienzo»)

- **Verlo con clics con datos reales** de un cliente: lo de arriba corrió sobre una automatización
  inyectada. Sin clic quedaron: editar la píldora del DELAY, crear una tarjeta con el botón derecho en un
  punto, Duplicar, la lista «⚡ Cuando…» del CRON y el botón Acomodar.
- La lista: el reparto la ubicaba en `ChatAgentApp.tsx` y vive en `app/chatbot/SimuladorWhatsApp.tsx`
  (las divisiones y los íconos del «⋯» son dos hunks ahí). Los íconos del desplegable del FILTRO salen de
  `lib/chatbot-lista-filtro.ts`, que no es de esta parte.
- Las posiciones (lo movido, la suelta, «Acomodar») siguen afuera de Ctrl+Z: «Acomodar» trae su deshacer
  en un aviso; mover una tarjeta, no.
- La papelera del círculo aparece al pasar el cursor por la tarjeta (o con la tarjeta elegida), no siempre.
## Sexta tanda (09/10/2026, parte «disparadores»): varios CRON por automatización

Una automatización tiene ahora una LISTA de CRON (`nutricion_secuencias.disparadores`, mig 0241) y
arranca por CUALQUIERA. El primero sigue viviendo también en las columnas de siempre (`trigger_tipo`,
`etapa`, `cron`…), que leen unos quince lugares; los demás, sólo en la lista. **La regla para código
nuevo: quien pregunta «¿esto dispara esta automatización?» recorre `vistasPorDisparador(sec)`
(`lib/disparadores.ts`), nunca `sec.trigger_tipo` solo** — eso es el primer CRON, no la automatización.

### Un Recurrente con «A quién» arrancaba TAMBIÉN por el evento [motor]

Con el CRON único, una secuencia con `cron` y `trigger_tipo: 'etapa_actual'` era «cada lunes a las 9, a
los que están en Agendado» — y `enrolarPorEvento` la inscribía además en el momento en que alguien
entraba a Agendado, porque sólo miraba `trigger_tipo`. Con varios CRON eso deja de ser un detalle: un
«Recurrente» y un «Producto» sobre la misma etapa son dos cosas distintas. El evento saltea los CRON con
horario (`!s.cron`) y `disparaPorEvento` devuelve false para un horario. Medido en prod el 09/10: **cero
secuencias con `cron`**, así que el cambio no le mueve nada a nadie hoy.

**Vive en:** `lib/nutricion.ts` (`enrolarPorEvento`) · `lib/disparadores.ts` (`disparaPorEvento`)

### Guardar la lista entera corría el ancla de los horarios a «ahora» [motor]

Cada toque del panel (un «A quién», el evento de OTRO CRON) guarda la lista completa, y la primera
versión recalculaba la próxima ocurrencia de todos los horarios: un «todos los lunes a las 9» guardado
un lunes a las 10 saltaba al lunes siguiente y perdía la de hoy, o la que el motor ya había reclamado.
`conProximas` conserva la de antes si la firma del horario de ESE CRON no cambió. Es la regla de
AGENTS.md («un horario se ancla en la ocurrencia anterior») aplicada a un guardado que no es del horario.

**Vive en:** `lib/disparadores.ts` (`conProximas`) · `lib/disparadores-guardar.ts`

### Un CRON extra con horario necesita su propio compare-and-set, y sin la 0241 no existe [motor]

El CAS de siempre (`.eq('cron_proxima_at', …)`) cubre sólo la columna, o sea el primero. Los horarios
de los demás viven en el JSON: se reclaman con un CAS sobre `disparadores_rev`, que sube en cada
escritura (`reclamarOcurrenciaExtra`). Con la 0241 sin aplicar no hay `rev`: el motor no reclama ningún
extra y el guardado rechaza una lista de más de uno («Aún no se pueden varios CRON.») en vez de guardar
la mitad.

**Vive en:** `lib/nutricion.ts` (`comprometerInscripciones`, `reclamarOcurrenciaExtra`) · `lib/disparadores-guardar.ts`

### «El grupo de MaKo» como destinatario: cómo corre un Recurrente sin lead [motor]

Un Recurrente con el grupo marcado, en cada ocurrencia RECLAMADA (no en el dry-run), le manda al grupo
de MaKo los TEXTOS de los mensajes del flujo (`textosParaElGrupo`) por `emitirAviso` (tipo
`chatbot-aviso-equipo`, `dedupKey` por ocurrencia). No corre condiciones, esperas ni acciones: sin lead
no hay de quién preguntar nada. Dos trampas:

- **`emitirAviso` sin workspace cae al `OWNER_WS`**, que es el ws1, un CLIENTE: un Recurrente de otro
  negocio le hablaría al grupo de Mauricio. `mandarRecurrenteAlGrupo` lee `wsEnContexto()` y sin él no
  manda nada.
- **El barrido sólo corre si el negocio tiene un canal prendido**: `app/api/cron/nutricion` llama a
  `comprometerInscripciones` dentro de esa condición. Un Recurrente que sólo le habla al grupo, en un
  negocio sin WhatsApp ni email, no sale. Es de la ruta del cron (otra parte): está en «sin hacer».

**Vive en:** `lib/nutricion.ts` (`mandarRecurrenteAlGrupo`) · `lib/disparadores.ts` (`textosParaElGrupo`)

### Sacar una etiqueta no avisaba nada, y la etapa no puede disparar «Se elimina» [etiquetas]

`sacarEtiquetaCon` no emitía ningún evento: «Se elimina etiqueta a un lead» no tenía de dónde salir.
Ahora emite `etiqueta_quitada` (con su clave de reclamo `etiqueta-quitada:<id>`), salvo cuando la saca
el cambio de ETAPA: mover a un lead de columna le saca la etiqueta de la columna vieja, y eso dispararía
«Se elimina…» en cada movimiento del kanban.

**Vive en:** `lib/etiquetas-motor.ts` · `lib/etiquetas.ts`

### El contrato con «canales» y «probar»: los eventos nuevos y su `subtipo` [motor]

`EventoNutricion` suma `etiqueta_quitada`, `instagram`, `messenger` y `email_recibido`, y `CtxEvento`
suma `subtipo` (Instagram: `comentario | historia | dm | anuncio | en_vivo | ref`; Messenger: `anuncio |
comentario | dm | ref | qr | tienda`). Hoy no los emite nadie: los webhooks son de la parte «canales».
Los eventos de anuncios se OFRECEN apagados («Todavía no»), como en ManyChat, y con el canal sin
conectar se apagan todos con su motivo (`GET /api/chat-agent/secuencias?canales=1`). «No pude
comprobarlo» también apaga: un evento que no puede llegar es una automatización que no arranca nunca.

**Vive en:** `lib/nutricion.ts` (`EventoNutricion`, `TRIGGERS_POR_EVENTO`) · `lib/disparadores.ts` (`EVENTOS_*`) · `lib/disparadores-canales.ts`

### El catálogo `TRIGGERS` no conoce los tipos nuevos [motor]

`lib/email-marketing.ts` (`TRIGGERS`) es el catálogo con el que `setTriggerSecuencia` valida y con el
que la API de MaKo nombra un disparador. Los seis tipos nuevos no están: el guardado de la lista los
acepta (`TRIGGERS_NUEVOS`), pero `setTriggerSecuencia` los rechaza y `labelDe(TRIGGERS, …)` devuelve el
slug crudo. Sumarlos ahí es de otra parte; mientras tanto, «Crear con IA» y la API sólo editan el
primer CRON con los tipos de siempre.

**Vive en:** `lib/email-marketing.ts` (`TRIGGERS`) · `lib/disparadores-guardar.ts`

### Un test de coherencia en verde con la rotura: el saneo ya hacía el trabajo [proceso]

La regla «`ignorar` sólo vale en las dos etiquetas genéricas» se probó quitándola de
`problemaDeDisparador`, y el test siguió verde: `higiene` (el saneo) ya borraba el campo antes de
validar. El diagnóstico obvio —«el test está flojo»— era el equivocado: la rotura no era observable por
ese camino. Hizo falta un caso que el saneo no limpia (un `subtipo` de Messenger en un CRON de
Instagram). Cuando un guard de validación pasa con la validación quitada, mirá primero si un saneo de
más arriba ya la cumple.

### Proceso: el scratchpad de una corrida es UNO para todas las partes [proceso]

Las ocho partes de esta tanda compartían el directorio de scratchpad: un `msg1.txt` con el mensaje de
un commit lo pisó otra parte antes del `git commit -F`. Se verificó el cuerpo después de commitear
(`git log -1 --format=%B`) y cada parte pasó a su propia subcarpeta. Es la regla de `/tmp` de AGENTS.md,
un nivel más adentro: un scratchpad por SESIÓN no es uno por AGENTE.

### Lo que quedó sin hacer (parte «disparadores»)

- **La tarjeta CRON del lienzo todavía no dibuja la lista**: `FlujoLienzo` ya tiene las props
  (`disparadores`, `onNuevoDisparador`, `onAbrirDisparador`) y SecuenciaPerfil las llena; dibujar una
  fila por CRON con su ícono y «＋ Nuevo CRON», y abrir el panel con ESE CRON, es de la parte «lienzo».
  `app/chatbot/FlujoLienzo.tsx`
- **El panel del Recurrente pide más alto**: `ALTO_EDITOR_CONTROL` de la entrada es 320 y el Recurrente
  con «A quién» mide ~440. `lib/lienzo-grafo.ts`
- **El barrido no corre sin un canal prendido** (ver arriba): un Recurrente sólo al grupo no sale.
  `app/api/cron/nutricion/route.ts`
- **Ninguna operación de la API cambia los CRON**: la ficha (`ficha_secuencia_mensajes`) los LEE;
  `setTriggerSecuencia` y las tools de antes siguen editando sólo el primero. Y «Crear con IA» elige uno
  solo. `lib/api-mako/areas/chatbot.def.ts` · `lib/flujo-ia.ts`
- **Los webhooks de Instagram, Messenger y Email no emiten los eventos** (parte «canales»), y «Probar»
  no simula un Recurrente ni un evento de canal (parte «probar»).
- **Aplicar la 0241 ANTES del deploy** (el código la tolera ausente: dispara sólo el primer CRON).
  Lo decide Martín. `supabase/migrations/0241_secuencia_disparadores.sql`
- **Nada se vio con clics**: los seis botones, el Recurrente (días, calendario, reloj, huso), «A
  quién», «Ignorar», los eventos apagados y las pastillas de dos CRON se probaron dibujando
  (`tests/editor-disparadores.test.ts`), no en un navegador.
## Sexta tanda (09/10/2026, parte «editores»): el desplegable de la casa, TAG con varias, ACTION en árbol, DELAY sin aviso

Pedido literal en la bitácora (9 oct 18:37): general 9, 10 y 11, CONDITION 2 a 4 («para todos lados»),
TAG 1 y 2, ACTION 1 y 2, DELAY 2 y CRON 1. Rama `wip-v6-editores`.

### Una tarjeta TAG con varias etiquetas: la acción acepta UNA y el validador tira el resto SIN ERROR [editores]

Lo obvio era guardar la lista en el paso (`etiquetaIds: [7, 8, 9]`) y dejar que el motor la corra. Medido el
09/10: `poner_etiqueta_lead` / `sacar_etiqueta_lead` declaran UN `etiquetaId: number`, y `validarInput`
(lib/api-mako/validar.ts) recorre sólo los `parametros` de la def: lo que la def no declara NO LLEGA y nadie
lo dice (`faltanEnPaso` tampoco lo ve). Una tarjeta con tres corría la primera —o ninguna— con la pantalla
mostrando tres. Lo hecho: la primera sigue en `etiquetaId` (así la leen sin cambios la tarjeta, el conteo de
uso, Crear con IA y el freno de Publicar) y TODAS van en `etiquetaIds` sólo si son más de una; con una, el
paso queda exacto como antes. Correr una por etiqueta es `unaPorEtiqueta` + `juntarPorEtiqueta`, para el
ejecutor. ⚠️ **Ese enchufe vive en `ejecutarDesdeFlujo` (lib/api-mako/flujo.ts), que no es de esta parte:
sin él corre sólo la primera.** Lo dice un test `todo` en tests/editor-etiqueta.test.ts.

La regla: un dato de MÁS DE UN VALOR en un paso de un flujo lo declara la def o lo parte el ejecutor;
guardarlo y confiar en que viaja es un éxito parcial callado. Los que leen la forma vieja (`params.etiquetaId`
solo), medidos: `etiquetaDeAccion` (lib/flujo-conversacion.ts), `usoDeEtiqueta` (lib/etiquetas-reglas.ts) y
lib/flujo-ia.ts (la vuelta a JSON de «Editar con IA», la resolución de las nuevas, `validarIA`).

**Vive en:** `lib/editor-acciones.ts` (`etiquetasDelPaso`, `paramsConEtiquetas`, `unaPorEtiqueta`, `juntarPorEtiqueta`) · `app/chatbot/EditorEtiqueta.tsx` · `app/chatbot/FlujoLienzo.tsx` (`EditorEtiquetaLienzo`)

### «Mover de etapa» y «Mover en otro producto»: cuál sirve lo decide el LEAD, no el flujo [acciones]

Para «faltan muchas acciones», lo obvio era sumar `mover_lead_en_producto`: «Mover de etapa»
(`proponer_cambio_etapa`) mueve SÓLO en el producto principal del lead —el producto que se elige en el editor
es una pista—. Medido en los `preparar` (lib/api-mako/areas/crm.run.ts): `mover_lead_en_producto` rechaza el
producto que es el principal del lead y el producto que el lead no tiene, sin `yaEstaba`. En un flujo pasan
leads con principales distintos, así que con las dos en el menú la equivocada falla en cada lead con una alarma
al dueño. Se dejó afuera, con su porqué en `ACCIONES_DEL_FLUJO`. Lo que falta es UNA «Mover de etapa» que, por
lead, corra una u otra según el producto elegido sea su principal o uno agregado (en el ejecutor, o una acción
nueva del registro).

**Vive en:** `lib/editor-acciones.ts` (`ACCIONES_DEL_FLUJO`) · `lib/api-mako/areas/crm.run.ts` · `app/_components/CamposAccion.tsx` (`SelectorEtapa`)

### Un campo `icono`, tres formas; y lo que cada negocio nombra no lleva ícono [ui]

El `icono` de un renglón del `Dropdown` acepta el NOMBRE de uno del set de la casa (app/_ui/iconos-menu.tsx,
para que lo pida una lista armada en un `.ts`), una URL o `data:` (los logos del ＋), o un dibujo. Un nombre
no trae `:`, `/` ni `.`, así que no se confunde con una URL. ⚠️ `esIconoMenu` va con `hasOwnProperty`: con
`s in TRAZOS`, «toString» era un ícono (lo cazó la rotura B10) y el renglón dibujaba nada con cara de algo.
Lo que nombra cada negocio (etapas, productos, etiquetas) va con su `color`, no con un ícono repetido. Y
«borrar» es UN dibujo (`TRAZOS_BORRAR`) en rojo que no se puede cambiar desde afuera: el rojo no es un prop.

**Vive en:** `app/_ui/iconos-menu.tsx` · `app/_ui/BotonBorrar.tsx` · `app/components/Dropdown.tsx` (`IconoOpcion`) · `app/components/dropdown-reglas.ts`

### Git Bash se come una barra de un argumento que empieza con `//`, y el scratchpad es de las ocho partes [proceso]

- `node reemplazar.mjs archivo nuevo "// ── Marca"` llegó como `/ ── Marca` (MSYS convierte lo que arranca con
  `//` como si fuera una ruta). El reemplazo por anclas calzó un carácter corrido: «///» arriba y «/ ──»
  abajo, y el typecheck lo dijo como «Unterminated regular expression literal» en una línea que no nombra
  la causa. Las anclas de texto van en un archivo (un JSON), nunca por la línea de comandos.
- El scratchpad de la sesión lo comparten las partes de la corrida: un `eol.mjs` de esta parte lo pisó otra
  con el mismo nombre en minutos, y `editores/` traía archivos de la cuarta tanda. Cada parte trabaja en una
  carpeta con su nombre y su tanda (`editores-v6/`).

### Lo que quedó sin hacer (parte «editores»)

- **Los enchufes en archivos ajenos** (el detalle exacto, en el informe de la parte): correr una por etiqueta
  en `ejecutarDesdeFlujo` (lib/api-mako/flujo.ts); «Agregar Cualificado y 2 más» en la tarjeta
  (`etiquetaDeAccion` / `textoEtiqueta`, lib/flujo-conversacion.ts); `usoDeEtiqueta` con todas
  (lib/etiquetas-reglas.ts); el ✕ del chip dice «Sacar» (`ChipEtiqueta`, app/_components/etiquetas-cliente.tsx);
  «Poner»/«Sacar» en app/crm/AccionesLoteLeads.tsx, app/crm/lead-view/EtiquetasDelLead.tsx, lib/etiquetas-motor.ts
  (el historial del lead), lib/api-mako/areas/crm.run.ts, crm.def.ts y whatsapp.run.ts, lib/flujo-ia.ts; y el alto
  del panel del TAG (`ALTO_EDITOR_CONTROL.etiqueta`, lib/lienzo-grafo.ts: con varias, 140 scrollea).
- **El barrido del tacho por toda la app** (general 9): `BotonBorrar` / `IconoBorrar` existen y no los usa
  todavía ninguna pantalla. Los lugares: el 🗑 del panel del lienzo (`app/_components/Lienzo.tsx:1060`, el que
  Martín ve); `Icon name="trash"` (app/admin/ui/CatalogoUI.tsx:193, app/_components/PanelAgencia.tsx:66/363/387,
  app/chatbot/GrabadorAudioPaso.tsx:168, app/chatbot/OnboardingChatAgent.tsx:1176,
  app/integraciones/NombrarVideos.tsx:245, app/integraciones/ProbarTracking.tsx:298/677,
  app/integraciones/ServicioConfigForm.tsx:806, app/video-generator/EditorAnuncio.tsx:516,
  app/video-generator/ElegirFoto.tsx:240, app/video-generator/PasoTomas.tsx:411,
  app/ads-manager/BarraAcciones.tsx:369); `IconTrash` del composer (app/whatsapp/_shared/composer-icons.tsx:26,
  usado en app/chatbot/EditorMensajeWhatsApp.tsx:560, app/whatsapp/_shared/ComposerWhatsApp.tsx:342,
  app/whatsapp/_shared/VoiceRecorder.tsx:179); el 🗑 de app/experimentos/RetroTab.tsx:113/188; los trazos sueltos
  de app/crm/AccionesLoteLeads.tsx:147, app/crm/CrmBoard.tsx:263, app/onboarding/Archivero.tsx:79 y
  app/_ui/EditorRico.tsx:542. Las ✕ que BORRAN (no las que cierran) quedan por contar aparte.
- **Los íconos en los ~71 desplegables de la app** (general 10): el `Dropdown` los dibuja y el set existe; los
  pusieron sólo ACTION, TAG y DELAY.
- **Las acciones de Customer Success de la rama de la API** (`wip/api-acciones-0910`: mover en la entrega,
  invitar al curso, mandar el link, cortar el acceso, abrir un módulo): entran a `ACCIONES_DEL_FLUJO` cuando
  la rama llegue a main, y piden controles nuevos (el servicio y la etapa de la ENTREGA, no las del CRM).
- Los campos de abajo del selector de ACTION siguen a 40 de alto (`Select` de app/_ui): «botones gigantes»
  quedó en el principal. `app/_components/CamposAccion.tsx`
- Verlo con clics: el árbol de ACTION, el TAG con tres chips y «＋ Otra», el DELAY a 56 y un desplegable de 8
  opciones con su buscador.
## Sexta tanda (09/10/2026, parte «canales»): Instagram y Messenger por Zernio

Medido contra la doc de Zernio (`docs.zernio.com/llms-full.txt` y `zernio.com/openapi.json` v1.249.1,
bajados el 09/10/2026) y contra producción en sólo lectura. **No se mandó un solo mensaje ni se recibió
un evento real**: todo lo de abajo que dice «doc» es lo que Zernio documenta, no lo que se vio pasar.

### Los disparadores de ManyChat contra lo que Zernio entrega [canales]

| ManyChat | Canal | Qué lo trae en Zernio | ¿Va? |
|---|---|---|---|
| Comenta tu publicación o Reel | Instagram | `comment.received` (`comment.isLive` ausente) | sí: se contesta por privado, UNA vez y en 7 días; a quien no sigue la cuenta, sólo texto |
| Responde a tu historia | Instagram | `message.received` con `metadata.storyReply` | sí |
| Te envía un mensaje | Instagram | `message.received` | sí |
| Hace clic en tu anuncio | Instagram | `message.received` con `metadata.referral.ad_id` | sí: Meta suele mandar primero el post del anuncio SIN referral y el referral en el mensaje que sigue |
| Comenta en tu En vivo | Instagram | `comment.received` con `comment.isLive: true` | sí: la respuesta privada sale mientras el En vivo está al aire |
| Clic en tu enlace de referencia | Instagram | `metadata.referral.ref` (o `referral.received` en un chat que ya existía) | sí, con trampa: en un chat NUEVO Instagram manda el `ref` sólo si la cuenta tiene un Ice Breaker |
| Hace clic en tu anuncio | Messenger | `metadata.referral.ad_id` / `referral.received` (clic de vuelta) | sí |
| Comenta tu publicación | Messenger | `comment.received` (platform `facebook`) | sí, con una duda NO medida: el id del autor de un comentario de Facebook puede no ser su PSID de Messenger, y entonces quien comenta y quien contesta la respuesta privada serían dos filas (en Instagram los dos son el IGSID) |
| Te envía un mensaje | Messenger | `message.received` | sí |
| Clic en tu enlace de referencia | Messenger | `referral.received` / `metadata.referral.ref` | sí |
| Escanea un código QR | Messenger | el mismo `referral`, con un `ref` que empieza con `qr-` | sí, por convención: Meta no distingue escanear de tocar (el QR es el link `m.me/…?ref=qr-…`) |
| Mensajes de tu tienda de Facebook | Messenger | — | **NO: apagado**, «Zernio no avisa los mensajes que llegan desde la tienda» |

La tabla vive en código (`DISPARADORES_SOCIALES`) y `tests/canal-social.test.ts` exige que cada fila
«disponible» la produzca un cuerpo del webhook. Una mención en una historia SÍ llega
(`metadata.isStoryMention`) y no la escucha ningún disparador: no es «te envía un mensaje».

**Vive en:** `lib/canal-social.ts` (`DISPARADORES_SOCIALES`, `eventoSocialDe`)

### Instagram NO es el WhatsApp no oficial: la ventana de 24 h acá SÍ existe [canales]

AGENTS.md dice «el WhatsApp del chatbot no tiene ventana de 24 h», y el reflejo es copiar el WhatsApp
tal cual. Para Instagram y Messenger es al revés: un DM sale dentro de las 24 h del último mensaje DE LA
PERSONA, o como la única respuesta privada a un comentario (7 días). Fuera de eso Instagram acepta sólo
`HUMAN_AGENT`, que por política de Meta es para una persona que contesta, nunca para una automatización.

- Un paso social fuera de la ventana NO sale y es **terminal** (cierra el hilo con su motivo): reintentar no
  la abre; sólo la abre la persona escribiendo.
- El reloj de acá es la pre-guarda; lo que manda es la respuesta de Zernio (`PLATFORM_LIMITATION`,
  `privateReplyConsumed`, `not_thread_owner`: `esLimiteDeMeta`).
- **El freno de 20 h del WhatsApp NO aplica**: protege a la línea no oficial de un baneo, y frenar 20 h un
  segundo DM lo dejaría fuera de la ventana.
- Un DELAY de más de 24 h antes de una tarjeta de Instagram la deja siempre afuera: el editor todavía no lo avisa.

**Vive en:** `lib/canal-social.ts` (`decidirSalida`) · `lib/canal-zernio.ts` · `lib/nutricion.ts` (la rama social)

### Un paso de Instagram le habría salido al lead POR WHATSAPP, sin un error [canales]

El diagnóstico obvio era «falta la rama de envío». La causa real eran dos lugares que convierten en
WhatsApp todo lo que no reconocen:

- `setSecuenciaPasos` guardaba `canal: email ? 'email' : 'whatsapp'`: la tarjeta de Instagram se publicaba
  como WhatsApp. Ahora `canalAGuardar` la conserva.
- La respuesta de «Si responde» (`responderConGrafo`) preguntaba `proveedorDelPaso(p) !== 'no_oficial'`, y un
  paso de Instagram «es» no oficial porque no tiene plantilla: salía por la línea. Ahora se frena antes.

La regla está en AGENTS.md: un camino que manda lo que dice un paso pregunta `esCanalSocial` ANTES de
decidir que es WhatsApp.

**Vive en:** `lib/nutricion.ts` (`setSecuenciaPasos`, `procesarEnvios`, `responderConGrafo`)

### El webhook de Zernio nunca entregó un evento: con key propia, el webhook vive en SU cuenta [canales]

Medido en producción (09/10/2026): los dos negocios con Zernio (ws11 y ws13) tienen key PROPIA, fila de
ruteo por profile y `zernio_workspace.webhook_ok = false` desde agosto. No es la firma ni el ruteo: con
key propia el webhook se registra en la cuenta de Zernio DEL NEGOCIO, y nadie lo registró. Lo registra
MaKo (`asegurarWebhook`, idempotente, con el secreto de la plataforma) cuando el editor de la tarjeta pide
la cuenta (POST `/api/zernio`, «estado»).

Y dos trampas de la forma del evento: **un `comment.received` NO trae el profile** (sólo
`account.accountId`), así que el ruteo por profile no alcanza y cada cuenta conectada se reclama aparte
(`zernio_cuenta`); y **Zernio corta a los 5 s**, así que el webhook guarda rápido y dispara la
automatización en `after`. El dedup es por el id del EVENTO (`zernio_eventos`, mig 0242), que es el mismo
en cada uno de los 7 reintentos.

**Vive en:** `lib/zernio.ts` (`asegurarWebhook`, `cuentasConectadas`) · `app/api/webhooks/zernio/route.ts` · `app/api/zernio/route.ts`

### Trampas chicas que se pagan caro [canales]

- **`createLead` tira `meta_ad_id` sin avisar**: lo tiene en `LeadCreateInput` y no en el insert (sí lo
  escribe el alta del instant form). Pasarlo no da error y no guarda nada. `lib/leads.ts`
- **Instagram rechaza el MP3 y el OGG/Opus** (doc de Zernio): las notas de voz de la biblioteca de WhatsApp
  no salen por ahí, y por eso el editor social no graba audio.
- **Un test no puede importar un módulo `server-only`** (el paquete tira fuera de `react-server`): el webhook y
  el motor se fijan sobre el FUENTE, y lo que decide va en módulos puros (`lib/canal-social.ts`,
  `lib/zernio-firma.ts`) que sí se ejecutan.
- **Un ancla de rotura tiene que poder fallar**: dos de las roturas del arnés pasaron en verde la primera vez
  porque el reemplazo no tocaba lo que el assert miraba (un `JSON.parse(raw || …)` contra un assert que busca
  `JSON.parse(raw)`). Se rehicieron; el número que vale es el de la segunda corrida.

### Lo que quedó sin hacer (parte «canales») [canales]

- **Una respuesta por Instagram NO pausa la salida**: `pausarPorRespuesta` pausa y además contesta (asistido,
  «Si responde», la charla) POR WHATSAPP. Hace falta que el motor conteste por el canal donde le escribieron.
  `lib/nutricion.ts` · `lib/zernio-entrante.ts`
- **El tinte de la tarjeta** (`CanalTarjeta` e `identidadDeTarjeta`, de la parte «lienzo») y el rótulo de
  «Probar» con varios canales (`SecuenciaPerfil`). Los colores están en `IDENTIDAD_SOCIAL`.
  `lib/lienzo-grafo.ts` · `app/_components/Lienzo.tsx` · `app/chatbot/SecuenciaPerfil.tsx`
- **El editor del CRON con los doce disparadores** (parte «disparadores»), el QR dibujado y los Ice Breakers
  que pide el `ref` de Instagram. `lib/canal-social.ts` (`DISPARADORES_SOCIALES`, `linkDeReferencia`)
- **Medir en Messenger si quien comenta y quien contesta son la misma fila** (ver la tabla). Si no, la unión
  sale del eco de la respuesta privada (`message.sent`), que hoy no se escucha. `lib/zernio-entrante.ts`
- **Verlo con clics y un evento real**: nada de esto recibió un webhook de verdad.
## Sexta tanda (09/10/2026, parte «whatsapp»): el audio, la grabación, el número y el ✦ por mensaje

### El audio «que no se escucha» no era el audio: un porcentaje cíclico dejaba el reproductor en 0 px [whatsapp]

Síntoma (WhatsApp 1 y 8): en el editor del lienzo la burbuja de un audio salía vacía («no aparece nada») y
en /whatsapp un audio propio mostraba sólo «—» y «⋮», sin play ni duración. Es la familia de la #350.

El diagnóstico obvio —el MP3 de lamejs sin cabecera Xing que la tarjeta #350 apuntaba— era el equivocado.
Medido en orden: **datos** (`wa_mensajes` 89057 del ws1, el audio que Martín se mandó: `media_path` puesto,
MP3 válido, cabecera `fffb`, 30.528 bytes); **server** (la URL firmada contesta 206 `audio/mpeg`);
**navegador** (el mismo archivo en un `<audio controls>` de 240 px dura 2,544 s y suena). Con la burbuja
REAL renderizada y medida en Chrome: el `<audio>` medía **43 px** en /whatsapp y **0 px** en el editor.
La burbuja se ajusta a su contenido (`max-width: 78%` en un flex) y el reproductor tenía
`width: min(240px, 100%)`: ese 100% es cíclico, y para un elemento REEMPLAZADO el navegador lo resuelve
contra cero al calcular el ancho de la burbuja. En /whatsapp sólo la hora y las palomitas le daban 45 px;
los controles nativos de Chrome se esconden de a uno cuando no entran, y el play es el primero que se va.

La regla: **un reemplazado (`audio`, `video`, `img`) adentro de una caja que se ajusta a su contenido lleva
un ancho en px, nunca un % ni un `min(px, %)`**: el % se resuelve contra la caja que mide lo que mide él. El
reproductor pasó a ser propio (▶, avance y tiempo) con ancho en px; adentro de una caja de ancho conocido
(la tarjeta), `100%`. Y para diagnosticar «no se ve», se mide el ancho del elemento antes que el archivo.

**Vive en:** `app/whatsapp/_shared/AudioPlay.tsx` · `app/whatsapp/_shared/BurbujaHilo.tsx` (`ANCHO_AUDIO`) · `tests/whatsapp-sexta-tanda.test.ts`

### Un 78% de una caja que se ajusta a su hijo es un hueco del 22% [whatsapp]

Síntoma (WhatsApp 4): el lápiz y la papelera de la segunda burbuja quedaban lejos del mensaje. La burbuja
llevaba su `max-width: 78%` adentro de un envoltorio que se ajusta a ella: el envoltorio crecía hasta el
ancho del texto y la burbuja ocupaba el 78% de eso, alineada a la derecha. Con un texto largo, un cuarto de
la fila vacío entre los botones y el mensaje. **El tope de ancho lo pone la FILA** (el envoltorio con
`max-width: calc(100% - 70px)`), y la burbuja va al 100% de él (`BurbujaHilo` `maxAncho`). Medido en
Chrome después: 6 px entre la papelera y la burbuja.

**Vive en:** `app/chatbot/EditorMensajeWhatsApp.tsx` (`vista`) · `app/whatsapp/_shared/BurbujaHilo.tsx` (`maxAncho`)

### «Terminar» no es «mandar», y un MediaRecorder parado no se reanuda [whatsapp]

Pedido (WhatsApp 7): «al darle enviar, en cualquier lado, no se debe enviar, se debe "terminar"… y donde
aparece el punto rojo, el botón de reproducir… Y si apreto el botón de enviar otra vez, ahí sí se envía».
La sesión (`crearSesionVoz`) va sobre el grabador de siempre: cada ✓ es un `stop` cuyo blob NO se entrega,
se guarda como TRAMO; la ➤ une los tramos y recién ahí entrega. Tres cosas que no se ven en el código:

- **«Seguir grabando» después de terminar no existe en MediaRecorder**: parado, no se reanuda. Pausarlo en
  vez de pararlo dejaba el micrófono prendido mientras la persona escucha. Se graba otro tramo y se unen
  decodificando (Web Audio) en un WAV; quien manda lo pasa a MP3 igual que a un tramo solo (`blobToMp3`
  decodifica cualquier cosa que el navegador entienda), así el camino de envío no cambia.
- **`audioAlSoltar` (EmpresaInbox) ya no decide nada** y el archivo que la pasa no se tocó: la regla vive en
  el composer, que es por donde pasan los tres que graban («en todos lados»). Lo mismo para los grabadores
  del onboarding (`GrabadorAudioPaso`) y `PasoAudioControl`.
- **El composer de ChatHilo va por conversación** (`key`): una escucha a medias ya no viaja al chat de al
  lado. El borrador de AUDIO por chat que guardaba ChatHilo se fue con esto, a sabiendas.

Probado en Chrome con micrófono FALSO (`--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`
y `permissions: ['microphone']`): grabar → ✓ → la barra de escuchar (sin ➤ mientras graba) → 🎤 → ✓ → el
WAV unido dura 2,76 s y suena → ➤ entrega UNA vez.

**Vive en:** `app/whatsapp/_shared/VoiceRecorder.tsx` (`crearSesionVoz`, `useGrabacionVoz`, `BarraGrabacion`, `unirAudios`) · `app/whatsapp/_shared/ComposerWhatsApp.tsx` · `app/whatsapp/_shared/ChatHilo.tsx`

### La línea de UN mensaje: en el paso, `null` no es «la de por default» [whatsapp]

WhatsApp 2: el número es de cada tarjeta (`linea` del paso; el motor manda con `lineaDelPaso(paso) ??
sec.instance_name`). El selector de siempre guardaba la de por default como `null`, que en la SECUENCIA es
«la de por default» y en el PASO es «la de la automatización» —que puede ser otra—: elegir la principal en un
mensaje lo dejaba siguiendo a la automatización. Con `explicita` se guarda su nombre (`lineaElegida`).
Y `setSecuenciaPasos` la reconstruye con la regla de las variantes: con la clave manda lo que llega, sin la
clave (la API, /email, el generador) se conserva la del mismo paso por su id (`lineaAlGuardar`). Una línea
pedida que no es del negocio no está en `lineasEvo`: `canalDeLinea` frena el envío con su motivo, sin caer
a otra (AGENTS.md, «Un negocio tiene VARIAS líneas»).

**Vive en:** `lib/mensaje-partes.ts` (`lineaDelPaso`, `lineaAlGuardar`) · `lib/nutricion.ts` (la línea del envío y `setSecuenciaPasos`) · `app/chatbot/SalidaWhatsApp.tsx` (`lineaElegida`) · `app/chatbot/EditorMensajeWhatsApp.tsx` (`CabeceraWhatsApp`)

### La pausa entre los mensajes de una tarjeta duerme ADENTRO de la corrida: por eso es corta [whatsapp]

WhatsApp 11. Las partes salen una detrás de otra en la MISMA ejecución (`enviarPartesDelPaso`): una pausa es
el motor durmiendo. El cron (`maxDuration` 300) manda hasta 6 leads y además duerme hasta 150 s por las
esperas cortas; con pausas de minutos, seis leads se comen la función, y una función cortada a la mitad no
escribe cuántas partes salieron: el reintento le repite al lead lo que ya leyó. Topes: 10 s por pausa y 20 s
por tarjeta (`problemaDePartes` al guardar, `pausaAntesDe` en el motor); para más, la tarjeta DELAY, que
programa en vez de dormir. Dos trampas: el audio con pie de siempre (`formaGuardada`) colapsaba
[audio, texto] a los campos de antes y la pausa del texto no tenía dónde guardarse (con pausa, se guarda
como dos partes); y la pausa por default era 1,2 s y la pantalla decía «1 s» (pasó a 1 s redondo).

**Vive en:** `lib/mensaje-partes.ts` (`pausaAntesDe`, `pausasPosibles`, `PAUSA_TOTAL_MAX_S`, `formaGuardada`) · `lib/nutricion.ts` (`enviarPartesDelPaso`)

### El ✦ de MaKo: el contexto por el REGISTRO, y lo que el registro no deja ver desde la app [whatsapp]

WhatsApp 3. La ruta lee el negocio, los productos, el embudo, el curso y la voz con `ejecutarOperacion`
(canal `app`, alcance lectura): las mismas lecturas de MaKo por WhatsApp, con su gating. **`listar_cursos`
contesta 404 desde la app**: el área `curso` declara `canales: ['http']`. Se pide igual y se saltea; el día
que el área sume `'app'`, entra sola (está en «bloqueantes» del reparto). Dos más:

- **El detector de voseo marca «acá»** (`marcasDeVoseo`, lib/puestas-data.ts): un mensaje del modelo con
  «agenda acá» se descarta como voseo. Para el neutro es «aquí»; lo dice el prompt.
- **El «demasiado corto» de WhatsApp 6** (`GUION_PALABRAS.min` 25, lib/guion-audio.ts) no pasa por el ✦: el
  filtro del panel no tiene piso (un audio corto es un audio) y sí el techo. El botón «✦ guion» que lo
  disparaba salió de la grabación; el piso sigue vivo para «Escríbeme el guion» del onboarding.

**Vive en:** `lib/mako-redacta.ts` · `app/api/chat-agent/redactar/route.ts` · `app/chatbot/MakoRedacta.tsx`

### Proceso: un componente del lienzo se verifica sin `next dev`, con esbuild y Chrome [proceso]

`renderToStaticMarkup` sirve para medir anchos (el HTML real en Chrome headless) pero no ata eventos: un ▶
no suena. Para probar un gesto, esbuild (el del clon) arma el componente con React vivo en un `.js` suelto
(`alias` al worktree, `nodePaths` al `node_modules`) y Playwright lo abre por `file://` con
`--allow-file-access-from-files`. Necesita un `banner` con `var process = { env: {...} }`: `next/link`, que
entra por `app/_ui/Link`, lee `process.env` al importar y sin eso la página queda en blanco. Para grabar,
los flags del micrófono falso de arriba. Ni un POST a producción, y sin el `turbopack.root`.

### Dos guards de OTRAS áreas leían lo que esta parte tocó, y sólo los vio el `npm test` completo [proceso]

Los tests de los archivos tocados daban 124/0; la suite entera, 6400/2. Los dos rojos eran guards que leen
fuente de otra área:

- **Un prompt que CITA el voseo para prohibirlo cae en el guard del voseo** (`tests/puente-panel-copy.test.ts`
  barre `lib/` entero): «Nada de voseo («tenés», «querés»)» en `lib/mako-redacta.ts` lo frenó. Se nombran
  las formas neutras («tienes», «quieres»), nunca las prohibidas.
- **La línea por mensaje rompía un guard de Comunicación**: `tests/lineas-whatsapp.test.ts` exigía
  `const lineaSec = sec.instance_name;` literal en la rama del no oficial de `lib/nutricion.ts`. Se mudó a
  la forma nueva (`lineaDelPaso(paso) ?? sec.instance_name`), probado rompiéndolo (15/1).

La regla: antes de dar por cerrada una parte que toca `lib/nutricion.ts` o un prompt, `grep` de la ruta en
`tests/` (`leer('lib/nutricion.ts')`) dice qué otros guards la miran; correr sólo los propios no los ve.

**Vive en:** `tests/lineas-whatsapp.test.ts` · `tests/puente-panel-copy.test.ts` · `lib/mako-redacta.ts`

### Lo que quedó sin hacer (parte «whatsapp»)

- **Las Notificaciones con la tarjeta MAKO y el editor nuevo (MaKo en WhatsApp 3)**: su lienzo es
  `app/agencia/FlujoAviso.tsx` + `lib/flujo-aviso.ts` (la tarjeta «WHATSAPP» sale de `grafoDeAviso`, del
  CÓDIGO: no hay datos que convertir) y el editor viejo es `app/agencia/EditorMensaje.tsx`. Quedó listo
  `EditorMensajeGrupo` para montarlo; los cambios exactos están en «bloqueantes» del reparto.
- **El título de la TARJETA MAKO** en el lienzo sigue «MAKO» (`TITULO.mako`, `lib/flujo-conversacion.ts`); la
  cabecera del panel ya dice «MaKo en WhatsApp».
- **El onboarding del Video Generator** (`app/video-generator/OnboardingVideoGen.tsx`) sigue con el grabador
  que entrega al soltar (tiene la barra nueva, no la escucha) y la tarea del alumno
  (`app/compartido/curso/[token]/TareaAlumno.tsx`) tiene su propio MediaRecorder.
- **El disparador no le llega al ✦** (el `disparador` del lienzo a `EditorDeNodo`, `app/chatbot/FlujoLienzo.tsx`).
- **El clon de configuración se lleva la línea POR MENSAJE** (`secuenciaParaElDestino`, `lib/clonar-config.ts`):
  vacía `audio_id` y `media_id` y deja la `linea` del paso, que nombra un número del DUEÑO. En el destino
  `elegirLinea` la rechaza (no es del negocio) y ese mensaje no sale, sin caer a la de por default. Va
  `linea` en la misma lista, con su aviso («vuelve a la línea de la automatización»). Duplicar
  (`lib/secuencia-duplicar.ts`) es del mismo workspace y está bien que la conserve.
- **Verlo con clics en producción**: el ✦ con las keys reales de un cliente (sólo se probó la pantalla) y
  la grabación en Safari (el WAV unido se probó en Chrome).
## Sexta tanda (09/10/2026, parte «tiempo»): las esperas a la hora exacta, el horario de envío y el «{ }»

Pedido literal: DELAY 2 («No entiendo el texto "Sigue a la hora en punto"... Eso se hace en todo caso
en configuraciones, no aquí. No pongas esa limitación»), la respuesta del mismo día («Sin límite,
editable»), WhatsApp 10 y MaKo en WhatsApp 4 (el «{ }» en árbol, con muchos más datos, sin «Tu
negocio», igual en todos lados). Rama `wip-v6-tiempo`.

### Un tick cada minuto NO es la corrida de cada hora cada minuto: lo frenado sigue vencido [motor]

La salida obvia —pasar `/api/cron/nutricion` a `* * * * *`— corre el motor entero de cada negocio
cada minuto, todo el día, por una razón que no se ve en el código del cron: una fila frenada por el
anti-ban («msg <20h»), por el tope o por la lectura de la condición NO SE TOCA, sigue vencida, y un
motor que mira «todo lo vencido» la encuentra en cada vuelta. El tick nuevo
(`app/api/cron/nutricion-tick`, `1-59 * * * *`) mira sólo lo que venció en los últimos
`VENTANA_FRESCA_MIN` (10) minutos y, sin nada, termina con dos consultas para todos los negocios; lo
viejo lo sigue barriendo la corrida de cada hora (`0 * * * *`, las 24 h). Medido en prod el 09/10: 0
inscripciones activas, o sea que hoy el tick cuesta 2 consultas por minuto. Vercel Pro: 100 crons por
proyecto y cada minuto (docs del 15/07/2026); con éste son 38.

Lo que el corte no cubre: un hilo en paralelo frenado deja la fila con su hora vieja (la fila resume
el hilo que vence primero, lib/nutricion-hilos.ts), y otro hilo que vence después sale con la corrida
de la hora, no con el tick.

**Vive en:** `app/api/cron/nutricion-tick/route.ts` · `lib/espera-duracion.ts` (`VENTANA_FRESCA_MIN`, `desdeFresco`) · `lib/nutricion.ts` (`vencidasDesde`) · `lib/motor-tick.ts`

### Un tope «por corrida» es un tope por HORA disfrazado: al cambiar la cadencia se multiplica [motor]

`MAX_POR_CORRIDA` (6 WhatsApp) y `RESIDUO_POR_CORRIDA` (1) valían como ritmo anti-ban porque había 9
corridas por día. Con 60 por hora, una cohorte de 30 leads inscriptos juntos saldría en cinco minutos.
Lo cazó un test que ya existía (`tests/nutricion-residuo.test.ts` cruzaba el techo con vercel.json):
el cron nuevo no se dejaba contar. Ahora las corridas del cron comparten el cupo de la HORA DE RELOJ
(`enviosEnLaHora`, opción `cupoPorHora`) y el residuo arranca su contador en lo ya usado (1 por hora,
10 en 24 h, `residuoYaUsado`). ⚠️ De reloj y no 60 minutos móviles: con la ventana móvil, la corrida
de las 11:00 encontraba los 6 que mandó la de las 10:00:05 y no mandaba nada — y es la única que barre
lo viejo. La vía rápida de un evento sigue con su cupo de siempre (un lead).

**Vive en:** `lib/nutricion.ts` (`enviosEnLaHora`, `residuoYaUsado`, `procesarEnvios`) · `lib/nutricion-residuo.ts`

### Un mensaje del motor no se RECLAMA antes de salir: el compare-and-set no lo cubre [motor]

El diagnóstico obvio era «el motor ya tiene compare-and-set, dos corridas no pueden pisarse». Es cierto
para las condiciones, las esperas y las acciones (`modo: 'cas'`); el avance DESPUÉS de mandar un
mensaje es `modo: 'fila'` y el freno anti-ban se lee por lote: dos corridas que leen la misma fila
vencida a la vez mandan las dos. Con una corrida por hora casi no pasaba; con un tick por minuto, una
corrida que tarda más de 60 s (varios WhatsApp con su tipeo, una espera corta durmiendo) se pisa con la
siguiente. Va el TURNO del negocio (`conTurnoDelMotor`, compare-and-set sobre `mako.nutricion.turno`,
vence solo a los 6 min); la corrida de la hora lo espera hasta 60 s en total. La vía rápida no lo toma
(lo de antes, sin cambios).

**Vive en:** `lib/motor-turno.ts` · `lib/motor-tick.ts` · `app/api/cron/nutricion/route.ts` (`conTurno`)

### «No pude leer el horario» no es «sin horario» [motor]

El horario de envío (lib/horario-envio.ts, Configuraciones › Horario, apagado por defecto) se lee con
`getSettingEstricto`: con `getSetting`, una base caída devuelve `null`, y `null` ES «sin límite» — un
negocio que puso «de 9 a 18» recibía sus WhatsApps a las 3 de la mañana el día que Supabase tosía. Con
la lectura caída la corrida no manda (`saltado: 'horario-ilegible'`) y lo vencido queda para el minuto
siguiente. Y «sale al abrir» lo cumple el tick: en los primeros minutos del horario barre ENTERO lo
vencido de ese negocio (`acabaDeAbrir`), no sólo lo fresco.

**Vive en:** `lib/horario-envio.ts` · `lib/nutricion.ts` (`horarioDeEnvio`, `dentroDeVentana`) · `app/configuraciones/HorarioEnvioPanel.tsx`

### El motor dejaba CRUDO todo token con dígitos: el «{ }» no podía ofrecer más de cinco datos [motor, ui]

`aplicarVariables` (lib/template-vars.ts) matcheaba `[a-z_]+`: `{{lead_fecha_r1}}` salía literal al
lead. Y el motor resolvía sólo nombre, nombre completo, apellido, empresa y negocio, así que el selector
de WhatsApp no podía ofrecer la etapa ni la reunión (AGENTS.md: «La previsualización de un editor no
puede resolver un token que el motor NO resuelve»). Ahora hay UN catálogo (lib/variables-aviso.ts, 75
datos en 10 ramas) con la FUENTE de cada dato y su DESTINO, y el motor lo resuelve con
`datosParaElLead` en sus tres envíos (una lectura por entidad que el texto nombra). Con una llave sola
la regex sigue sin dígitos: un `{1}` de un copy de Meta no es una variable. Las plantillas OFICIALES
(`bodyParams`) siguen con los cinco: sus parámetros los registra Meta.

La regla: **antes de ofrecer un token en un editor, pasalo por la función del MOTOR**, no por la de la
vista previa. Y `lead_nombre` (el completo, de los avisos) y `nombre` (el primero, del motor) eran el
mismo nombre con dos significados: quedan los dos resueltos y sólo `nombre` / `nombre_completo` en el
árbol.

**Vive en:** `lib/variables-aviso.ts` · `lib/variables-del-lead.ts` · `lib/variables-resolver.ts` (`datosParaElLead`) · `lib/template-vars.ts` · `app/_components/SelectorDatos.tsx`

### `v_funnel_productos` no está en `TENANT_TABLES`: `getTenantDb` no la acota [entorno]

Una vista que no está en el `Set` de lib/workspace.ts pasa sin filtro de workspace. Se acota sola sólo
si se filtra por un id que ya es de un negocio (el `funnel_id`, que es global): eso hace el resolvedor
del curso. Una lectura de esa vista sin ese filtro devuelve los productos de todos los clientes.

**Vive en:** `lib/variables-resolver.ts` (`valoresDeSuCurso`) · `lib/workspace.ts`

### El scratchpad es COMPARTIDO entre las partes de una tanda [proceso]

Las 8 partes corren en worktrees distintos pero con el MISMO scratchpad. El mensaje de commit de esta
parte (`msg1.txt`) lo pisó, minutos después de usarlo, el de la parte «canales». Salió bien porque se
commiteó antes; al revés, esta rama llevaba el mensaje de otra. Cada parte escribe en su subcarpeta
(`scratchpad/<parte>/`) y verifica `git log -1 --format=%B` después de commitear.
## Sexta tanda (09/10/2026, parte «probar»): el email de «Probar», el emisor de la prueba real y el email que llega

### «Probar en Email» vacío: no era la bandeja, era el CONTACTO del lead de la prueba [probar]

**Síntoma:** «está configurado el email y en PROBAR no salió nada» — «Sin correos» y «Fin» abajo, en
la «Felicitación al terminar clase» (#226 del ws1: CRON → «Tiene WhatsApp» → Sí: WhatsApp + TAG; Si no:
EMAIL).

⚠️ **El diagnóstico obvio era el equivocado**: la bandeja, la animación y el envío andaban. Medido con
el flujo leído de la base: `hechosDeLeadNuevo` le daba al lead de la prueba teléfono Y email SIEMPRE,
así que «Tiene WhatsApp» salía por el «Sí» y el email del «Si no» no llegaba nunca. Es la misma familia
que «Agendó» en la quinta tanda: decidir como el motor está bien; el DATO estaba mal.

**Regla:** de un lead que acaba de entrar, lo único que NO se sabe es si tiene teléfono y si tiene
email. Esos dos se ELIGEN para el canal que se prueba (`contactoParaProbar`: los dos → sólo el canal
probado → sólo el otro → ninguno; el primero con el que llega algo de ese canal), corriendo el MISMO
recorrido de una vez (`mensajesDelRecorrido`). Lo que sí se sabe (sin agenda, sin pago) no se elige:
un email detrás de «Agendó» sigue sin llegar, y eso es lo que pasa de verdad.

**Vive en:** `lib/simulador-grafo.ts` (`contactoParaProbar`, `mensajesDelRecorrido`, `hechosDeLeadNuevo`) ·
`app/chatbot/PanelProbar.tsx` (`arrancarRefs`, el `case 'condicion'`) · `tests/probar-email-canal.test.ts`

### El email que llega (Resend): lo que hay que saber antes de tocarlo [email-entrante]

Medido el 09/10/2026 (doc oficial y la cuenta, sólo lectura):

- **El webhook `email.received` trae sólo el SOBRE** (`from`, `to`, `cc`, `received_for`, `subject`,
  `message_id`, los adjuntos sin contenido). El cuerpo se pide aparte: `GET /emails/receiving/{id}`.
  Para disparar alcanza; para una condición sobre el texto, hace falta esa llamada.
- **La cuenta de MaKo tiene UN dominio (hola-mako.com) con `receiving: disabled`, y su único webhook
  (a /api/webhooks/resend) YA está suscripto a `email.received`** y lo tira al `default`. O sea: el día
  que alguien prenda la recepción, los mails llegan a esa ruta y se pierden sin un error.
- ⚠️ **«Opción A: una cuenta de Resend para todos» no es del todo cierto**: los ws 1, 4, 10 y 11 tienen
  su propia `RESEND_API_KEY`, y el único `resend_domain` cargado (ws11, leilafittipaldi.com) NO está en
  la cuenta de MaKo. Un cliente con cuenta propia recibe en SU cuenta: haría falta un webhook allá con su
  secreto.
- **Se rutea por `resend_domain` (se reclama con titularidad), NUNCA por `resend_from`**: el del ws1 es
  «MaKo <equipo@hola-mako.com>», el dominio de la PLATAFORMA. Un subdominio cuenta (el MX recomendado va
  en uno), el reclamo exacto gana, dos workspaces → de ninguno.
- **La fila de `email_entrantes` es la deduplicación Y el rastro**: `email_id` único corta los reintentos
  de Svix; lo descartado queda con su motivo. Un mail de ningún negocio también queda escrito
  (`workspace_id` null), nunca asignado «por default».

**Vive en:** `lib/email-entrante-reglas.ts` · `lib/email-entrante.ts` · `app/api/webhooks/email-entrante/route.ts` ·
`supabase/migrations/0245_email_entrantes.sql` · `tests/email-entrante.test.ts`

### El emisor de la prueba real es un PEDIDO; lo autoriza el envío [probar]

«Probar en WhatsApp / Email» pide «De» (las líneas o el remitente del negocio, con «Vincular nuevo») y
«Para». El emisor viaja del navegador, así que el server no lo cree: la línea la resuelve `elegirLinea`
en el envío (una ajena no manda y NO cae a la de por default) y el remitente, `remitenteDelPaso` (mismo
dominio que el del negocio). Uno que no sirve corta con su motivo ANTES del tope, para no gastar un
lugar. Y hoy hay UN remitente por negocio: «Vincular nuevo» del email REEMPLAZA y lo dice.

**Vive en:** `lib/simulador-grafo.ts` (`sanearEmisorPrueba`, `lineaDePrueba`) · `lib/prueba-paso.ts` ·
`app/chatbot/PanelProbar.tsx` (`MenuDestinos`, `VincularEmisor`, `CANALES_PROBAR`)

### Lo que quedó sin hacer (parte «probar»)

- **Que llegue un mail de verdad**: prender «Receiving» en el dominio en Resend + el MX del cliente, y
  sumar `email.received` a la ruta nueva (un webhook con `RESEND_INBOUND_WEBHOOK_SECRET`) o delegarlo
  desde /api/webhooks/resend (`case 'email.received'` → `recibirEmailEntrante`). Lo decide Martín.
- **Un email del lead no PAUSA la automatización que le está escribiendo** (una respuesta de WhatsApp
  sí). Es del motor: `lib/nutricion.ts` (`pausarPorRespuesta` del lado del webhook).
- `email_entrantes` tiene que entrar a `TABLAS_DE_INQUILINO` (`lib/tablas-de-inquilino.ts`) y el
  servicio `'email'` a `ServicioRuteo` (`lib/webhook-ruteo-huella.ts`) para anotar los fallos de ruteo
  en el super admin como los demás webhooks.
- `app/chatbot/SimuladorEmail.tsx` tiene CERO call sites (lo reemplazó la bandeja de `PanelProbar`).
- Nada de esto se vio con clics: el desplegable «De / Para», «Vincular nuevo» en su modal y la bandeja
  con la #226.

## Lo que quedó sin hacer

**De la parte «tiempo» (sexta tanda, 09/10/2026):**

- **Montar el selector en los cinco «{ }»** (las líneas exactas, en el informe de la parte): el composer
  de WhatsApp (`app/chatbot/EditorMensajeWhatsApp.tsx`, el `MenuWA` de `abierto === 'datos'`), el email
  (`app/chatbot/EditorEmailGmail.tsx`, los dos `MenuWA` de datos), el editor de avisos
  (`app/agencia/EditorMensaje.tsx`, el `Dropdown` de secciones), la tarjeta MAKO (`app/chatbot/FlujoLienzo.tsx`,
  `DATOS_MAKO`) y los avisos (`app/agencia/FlujoAviso.tsx`, que ya recibe el árbol nuevo). Hasta que se
  monten, el WhatsApp y el email ofrecen los 4 de siempre (sin «Tu negocio») y el aviso, el árbol nuevo
  aplanado en secciones.
- **La tarjeta MAKO resuelve sólo los 5 del motor** (`textoDelAviso`, lib/api-mako/areas/chatbot.run.ts):
  pasarla a `conVariables(t, { ws, leadId, destino: 'equipo' })` ANTES de ofrecerle el árbol.
- **Borrar los cascarones** `sinPrecision` / `avisoDePrecision` (lib/espera-duracion.ts) junto con su uso en
  `EditorEspera` (app/chatbot/FlujoLienzo.tsx, el `const aviso = …` y `{aviso}`).
- **«Probar»** previsualiza con el lead de ejemplo de los 5 datos (`textoDeEjemplo`, lib/simulador-grafo.ts) y
  la prueba real con `valoresVariablesLead` (`probarSecuencia`, lib/setting-secuencias.ts): los tokens nuevos
  salen crudos ahí. Va `{ ...valoresDeEjemplo(), ...lo de hoy }`.
- **Textos de la API viejos**: «cada hora, en horario de envío» y «la ventana de 9 a 21» en
  lib/api-mako/areas/chatbot.run.ts (`cuandoSale`, la nota de la simulación) y chatbot.def.ts (dos descripciones).
- **Lo que decide Martín**: los recordatorios de clases (lib/curso-mensajes.ts) y las insistencias al grupo
  (lib/flujos-tipos.ts, `INSISTIR_VENTANA` 8-21) tienen su propio horario fijo y no siguen al de
  Configuraciones; ¿el horario del negocio vale también para ellos?
- **El curso de un lead es una aproximación** (lo que abre su acceso, o su entrega + el producto de su
  embudo + donde ya tiene avance): la regla completa vive en `universoDeLaEntrega` y lee la cartera entera.
  `lib/variables-resolver.ts`
- **El tick topea en 1000 filas** por minuto (PostgREST): con más, lo que queda sale al minuto siguiente o con
  la corrida de la hora. `app/api/cron/nutricion-tick/route.ts`
- **Verlo con clics**: Configuraciones › Horario y el selector en árbol.

**De la parte «lienzo» (quinta 2), lo que decide Martín:** si mover una tarjeta se deshace con Ctrl+Z (hoy
no: la pila es de los pasos), si hace falta un «Reacomodar» que vuelva al layout automático, y qué pasa con
una tarjeta soltada arriba o a la izquierda del margen (queda en coordenadas negativas y «Centrar» no la
cuenta; igual en /mensajes). La copia de «Duplicar» hereda el acomodo. `app/_components/Lienzo.tsx`

**Del punto 15 de la cuarta tanda (09/10/2026):** los tres enchufes que quedaron en archivos de otras
partes —el número de salida en el editor, «✦ MaKo» al lado del título (`accionesTitulo` de `Lienzo.tsx`)
y la tarjeta con «+N más» y sin la transcripción— y el «De» del email (punto 16) se ENCHUFARON al unir la
tanda, con `tests/chatbot-enchufes.test.ts` (7 roturas, las 7 en rojo). Lo que sigue sin hacer: el
marcador de cuántas partes salieron vive en `nutricion_envios.asunto` (una columna `partes_salidas` es el
arreglo de fondo) y el borrador del setter de un mensaje de varias partes junta los textos en uno
(`wa_borradores` no tiene partes). `lib/mensaje-partes.ts` · `lib/nutricion.ts`

**De la cuarta tanda (09/10/2026):** los puntos 1, 5, 6 (la cuota N), 7, 8, 11 (más acciones), 14,
15 y 16, cada uno con sus archivos, en `docs/relevo/chatbot.md` → «La cuarta tanda». El chat de CRM ya
dejó marcadas las etapas de reunión (`adf1ca3d`), que es lo que el punto 5 necesitaba.


**De la tercera tanda (09/10/2026)**

- **Verla en un navegador**: editor mediano, CRON por pasos, emoji, «⋯» de la lista, «Nueva», bandeja
  tipo Gmail de «Probar», editor rico del email, monto al mover a Ganado y la capa de Crear con IA.
- `proponer_cambio_etapa` no acepta el producto (`embudoId`); faltan en el registro «sacar de una
  automatización» y «mover en el kanban de entrega». `lib/api-mako/areas/crm.def.ts` · `cs.def.ts`
- Crear con IA sólo conoce las 9 condiciones de antes, no el catálogo. `lib/flujo-ia.ts`
- `getVslEngagementMap` se traga el error: con la base caída, «No reprodujo el VSL» se cumpliría para
  todos. Hace falta una lectura estricta para el motor. `lib/leads.ts`
- El modelo gratis de OpenRouter por default está muerto para TODAS las features y `CASCADA_DOCS` sigue
  con OpenAI y Mistral. `lib/ai-cheap.ts`
- La red de plataforma en Crear con IA (cliente con una sola key) y Cancelar que no frena la cascada. `lib/ai-cheap.ts`
- Las props muertas del editor de WhatsApp (`mostrarRevisar`, `revisarHeredado`, `disposicion`). `app/chatbot/EditorMensajeWhatsApp.tsx`
- **La key de Gemini de la plataforma está bloqueada por Google** (403): lo decide Martín.

**De la segunda tanda (09/10/2026)**

- **Verla en un navegador en producción**: el CRON con «Al entrar» y «Si responde», el ＋ en paralelo,
  las tarjetas de control, el editor apaisado (WhatsApp en fila, Gmail, la frase de etiqueta), el
  selector de acciones, «Probar» ancho con un email, y crear con IA de punta a punta en el ws3.
- **Las secuencias de los clientes están creadas EN PAUSA** (#221, #222 y la #220 en el ws1; #223 y
  #224 en el ws13). Falta que Martín las active, y el disparador de la #224: la etapa «noresp» no
  existe en el embudo del ws13 y `setTriggerSecuencia` la rechaza. Código Inmobiliario no tiene canal
  hoy.
- `saveLeadRespuestas` guarda el set entero en UN insert: una fila mala pierde todas. `lib/leads.ts`
- El «+N» de los avisos de la IA vive en el `title` (no se ve en un teléfono). `app/chatbot/SecuenciaPerfil.tsx`
- `asignar_closer_setter` salió de la lista blanca de la IA en vez de validar nombres. `lib/flujo-ia.ts`
- Un override guardado del prompt `chatbot.crear-ia.system` conserva el ejemplo viejo.
- El editor y «Probar» pintan itálica con `_…_` sin bordes (`lead_nombre_x`). `app/agencia/EditorMensaje.tsx` · `app/_components/TextoMarcas.tsx`
- `scripts/typecheck-lock.mjs` arma la ruta de tsc a mano: en un worktree anidado da MODULE_NOT_FOUND
  (va `createRequire(...).resolve('typescript/bin/tsc')`). Lo mismo `tests/replay-envoltorio.test.ts`.
- El detector de voseo bueno vive en un test; `validarIA` usa la lista corta.

**De la primera tanda — antes de desplegar (HECHO el 08/10)**

- **Aplicar la 0223, la 0224 y la 0225 ANTES del deploy** (el código nuevo lee sus columnas y
  tablas) y, después del deploy, correr `npx tsx scripts/migrar-secuencias-a-grafo.mts --aplicar`.
  Lo decide Martín. `supabase/migrations/0223_flujo_grafo.sql` · `0224_crm_etiquetas.sql` ·
  `0225_setting_adjuntos.sql`.
- **Nada lo vio todavía un navegador.** Ni las cinco partes ni los arreglos levantaron un dev
  server (bootear local escribe en prod, y con `node_modules` como junction Turbopack no arranca).
  Falta mirar: los puertos y las filas de Condición y de «Si responde», el ＋ de cada salida vacía,
  el panel de 392 px con el composer, la nota de voz con link y el PDF con caption en su alto fijo,
  «Probar» abierto al editar una tarjeta, el error de Publicar abriendo su tarjeta, el popover del
  emoji y del clip sobre el panel, y el recordatorio con sus 7 tarjetas.

**Riesgos vivos**

- (Arreglado el mismo 08/10, ver la entrada siguiente.) `armarSecuenciasDeAudios` escribía
  `pasos` directo sobre las secuencias del onboarding.
- **El «aviso repetido» se detecta por el PREFIJO del resumen** (`AVISO_REPETIDO`, `lib/nutricion-grafo-motor.ts`), porque `aplicarEnElActo` no devolvía los `datos` de la acción. Desde `c4309144` (sesión API de MaKo) `ResultadoFlujo` trae `datos`: `avisar_al_equipo` puede devolver `{ salio: boolean }` y el motor leerlo de ahí en vez de comparar texto.
- **`resolverHandoff` reactiva a 'activa' sin `proximo_envio_at`**: la cola filtra con `lte` y un
  null no entra nunca. Bug previo, sin arreglar. `lib/chat-agent-handoff.ts` (`resolverHandoff`).
- **No hay forma de devolverle la charla a MaKo después de un hand-off**: `resolver_handoff`
  necesita una fila en `chat_agent_handoffs`, que el flujo no crea, y hoy sólo la reabre una
  reinscripción (`reactivarInscripcion` limpia la charla). Decisión de producto.
  `lib/chat-agent-handoff.ts` · `lib/nutricion.ts` (`responderConGrafo`).
- **Publicar una secuencia convertida no resuelve el hand-off vivo** (la segunda mitad de
  lienzo-1): una inscripción en 'handoff' publicada desde el lienzo antes del script queda sin
  salida; el script sí lo resuelve. `app/chatbot/SecuenciaPerfil.tsx` · `lib/nutricion.ts`
  (`setSecuenciaPasos`).
- **El merge de `setSecuenciaPasos` trata `variantes: []` como ausente**
  (`Array.isArray(p.variantes) && p.variantes.length ? … : variantesPrevias.get(…)`): la ✕ de la
  última variante no la borra. No se cambió porque antes hay que auditar a los diez escritores de
  `pasos`: uno que mande `[]` siempre borraría las variantes en cada guardado. `lib/nutricion.ts`.
- **`generarVariantes` saltea sólo `tipo === 'audio'`**: la acción «variantes» le puede volver a
  escribir variantes al caption de un archivo. `lib/secuencias-variantes.ts`.
- **`normalizar` renombra un `o0` viejo si se inserta un paso SIN id al principio**: el nuevo toma
  `o0`, el viejo pasa a `o0_2`, y una inscripción con `nodo_actual = 'o0'` seguiría al paso nuevo.
  Todo escritor que inserte pasos les da `nuevoId`. `lib/flujo-grafo.ts` (`normalizar`).
- **`inscribir_lead_secuencia` desde un «⚡ Acción» sigue reiniciando lo terminado**: es la «orden
  explícita» de la regla 3 y no usa `desdeFlujo`. Si Martín quiere el mismo freno, se pasa desde
  `lib/api-mako/areas/chatbot.run.ts` cuando `desdeUnFlujo(ctx)`.

**Arreglos que faltan**

- **«Probar» no lee la estrategia local**: `responderSimulador` lee de lo GUARDADO nombre, etapa,
  objetivo, gancho, preguntas y criterio; del lienzo sólo llega el caso. Haría falta un
  `opts.estrategia`. `lib/setting-simulador.ts`.
- **Los hand-offs pendientes**: abrir directo la tarjeta «Si responde» al entrar por el aviso (hoy
  `?sec=` sólo elige la automatización) y resolverlos al publicar un caso nuevo.
  `app/chatbot/SimuladorWhatsApp.tsx` · `app/chatbot/SecuenciaPerfil.tsx`.
- **El inbox oficial sigue con su copia del composer** (la tercera). `app/whatsapp/WhatsAppApp.tsx`.
- **El comentario del `maxWidth` del panel del nodo dice content-box y es border-box**, y el `+ 30`
  sobra. `app/_components/Lienzo.tsx` (cerca de la línea 746).
- **Las etiquetas**: la vuelta WhatsApp→MaKo (una rama `labels.association` en
  `app/api/webhooks/evolution/route.ts`) y la columna de línea en `evolution_labels`; y los avisos de
  /mensajes no cuentan el uso de una etiqueta (`usoDeEtiqueta`, `lib/etiquetas.ts`). El detalle, en
  [hallazgos-comunicacion.md](hallazgos-comunicacion.md) y [hallazgos-crm.md](hallazgos-crm.md).
- **El tope de 40 caracteres del nombre vive en dos constantes**: `TOPE_NOMBRE_SECUENCIA`
  (`lib/setting-estrategia.ts`) y `TOPE_NOMBRE` (`app/chatbot/SimuladorWhatsApp.tsx`).
- **La condición «Está en la etapa» ofrece sólo las etapas de venta de los productos con embudo**:
  no ofrece «la casa» ni las de entrega, porque `HechosLead` no las tiene. `app/chatbot/FlujoLienzo.tsx`.
- **El recordatorio**: lo que se borra queda sin borrador, y cambiar de automatización con textos
  sin publicar los pierde sin preguntar. `app/chatbot/RecordatorioFlujo.tsx`.
- **El área `chatbot` de `/admin/dev` no apunta a este documento** (le falta `hallazgos:
  'hallazgos-chatbot'`). `app/admin/dev/areas.ts`.
