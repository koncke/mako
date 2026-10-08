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

### Estado de producción al cerrar la corrida (08/10/2026, medido con SELECT)

- Ni la 0223, ni la 0224, ni la 0225 están aplicadas.
- Una inscripción en 'handoff' (id 199, ws1, secuencia #198, lead 2590, paso 1) con su hand-off #3
  sin resolver; 0 inscripciones activas; 0 charlas cerradas; 0 secuencias con `funnel_id`.
- El dry-run de `scripts/migrar-secuencias-a-grafo.mts` da 6 secuencias para convertir (#198, #212,
  #213 y #220 del ws1; #209 y #210 del ws4) y 0 que no validan. No se corrió con `--aplicar`.

---

## Lo que quedó sin hacer

**Antes de desplegar**

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
